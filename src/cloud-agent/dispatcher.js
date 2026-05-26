const { parseAttachmentsFromMessage } = require("./attachment-materializer.js");
const {
  DEFAULT_DISPATCH_PROMPT,
  buildDispatchPrompt,
  directFellowIdsForMessage,
  fellowForMember,
  hostFellowIdFor,
  messageHasMentions,
  parseDispatchSpeak
} = require("../shared/group-fellow-routing.js");

function requireDep(deps, key) {
  if (!deps || !deps[key]) throw new Error(`${key} dependency is required`);
  return deps[key];
}

function messageRole(row) {
  if (row.sender_kind === "fellow") return "assistant";
  if (row.sender_kind === "system") return "system";
  return "user";
}

function createCloudAgentDispatcher(deps = {}) {
  const socialStore = requireDep(deps, "socialStore");
  const messagesStore = requireDep(deps, "messagesStore");
  const fellowsStore = requireDep(deps, "fellowsStore");
  const runtimeBindingsStore = requireDep(deps, "runtimeBindingsStore");
  const cloudAgentRunsStore = requireDep(deps, "cloudAgentRunsStore");
  const workerManager = requireDep(deps, "workerManager");
  const hermesRunsClient = requireDep(deps, "hermesRunsClient");
  const attachmentMaterializer = deps.attachmentMaterializer || null;
  const broadcastPersistedEvent = typeof deps.broadcastPersistedEvent === "function"
    ? deps.broadcastPersistedEvent
    : () => {};
  const broadcastTransientEvent = typeof deps.broadcastTransientEvent === "function"
    ? deps.broadcastTransientEvent
    : () => {};
  const loadPrompts = typeof deps.loadPrompts === "function"
    ? deps.loadPrompts
    : async () => ({ dispatch: DEFAULT_DISPATCH_PROMPT });
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const pending = new Set();

  function conversationHistory(roomId) {
    return messagesStore.listMessagesSince(roomId, 0, 200).map((row) => ({
      role: messageRole(row),
      content: row.body_md || ""
    }));
  }

  function canHandleFellow(args = {}) {
    const userId = String(args.userId || "").trim();
    const fellowId = String(args.fellowId || "").trim();
    if (!userId || !fellowId) return false;
    return Boolean(runtimeBindingsStore.getEnabledBinding(userId, fellowId, "cloud-hermes"));
  }

  function responseModeFor(room) {
    return room?.decorations?.responseMode === "mentions-only" ? "mentions-only" : "conductor";
  }

  function normalizeMessages(result) {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.messages)) return result.messages;
    return [];
  }

  function recentMessagesForDispatch(roomId, message) {
    const sinceSeq = Math.max(0, Number(message?.seq || 0) - 6);
    return normalizeMessages(messagesStore.listMessagesSince(roomId, sinceSeq, 6));
  }

  function conductorSessionId(userId, roomId, messageId) {
    return `cloud:${userId}:conductor:${roomId}:${messageId}`;
  }

  async function chooseCloudConductedMembers({ userId, roomId, room, message, enabledFellowMembers, fellows }) {
    if (room.type !== "group") return [];
    if (responseModeFor(room) !== "conductor") return [];
    if (enabledFellowMembers.length < 2) return [];
    const hostFellowId = hostFellowIdFor(room, enabledFellowMembers, enabledFellowMembers);
    const hostMember = enabledFellowMembers.find((member) => member.member_ref === hostFellowId);
    if (!hostMember) return [];
    const prompts = await loadPrompts().catch((error) => {
      log(`[cloud-agent-dispatcher] load conductor prompts failed: ${error?.message || error}`);
      return null;
    });
    const template = prompts?.dispatch || DEFAULT_DISPATCH_PROMPT;
    const fellowNamesById = {};
    const memberDescriptors = enabledFellowMembers.map((member) => {
      const fellow = fellowForMember(member, fellows);
      const name = fellow?.name || member.fellow_name || member.member_ref;
      fellowNamesById[member.member_ref] = name;
      return { id: member.member_ref, name };
    });
    const recentMessages = recentMessagesForDispatch(roomId, message);
    const dispatchPrompt = buildDispatchPrompt(template, {
      members: memberDescriptors,
      summary: room.contextCard?.summary || room.decorations?.pinnedGoal || null,
      recentMessages,
      fellowNamesById,
      userMessage: message.body_md || ""
    });
    const binding = runtimeBindingsStore.getEnabledBinding(userId, hostFellowId, "cloud-hermes");
    if (!binding) return [];
    const runtimeConfig = binding.config || {};
    const fellow = fellowsStore.getFellow(userId, hostFellowId) || { id: hostFellowId, name: hostFellowId };
    try {
      const worker = await workerManager.ensureWorker(userId);
      const result = await hermesRunsClient.runChat({
        baseUrl: worker.baseUrl,
        apiKey: worker.apiKey,
        userId,
        fellow,
        roomId,
        sessionId: conductorSessionId(userId, roomId, message.id),
        metadataRole: "group-conductor",
        model: runtimeConfig.model || "mia-default",
        effortLevel: runtimeConfig.effortLevel || "medium",
        permissionMode: "ask",
        input: dispatchPrompt,
        attachments: [],
        conversationHistory: []
      });
      const suggested = parseDispatchSpeak(result.content || "");
      const chosen = suggested.length ? suggested : [hostFellowId];
      const selected = chosen
        .map((fellowId) => enabledFellowMembers.find((member) => member.member_ref === fellowId))
        .filter(Boolean)
        .slice(0, 3);
      return selected.length ? selected : [hostMember];
    } catch (error) {
      log(`[cloud-agent-dispatcher] conductor dispatch failed: ${error?.message || error}`);
      return [];
    }
  }

  async function selectedFellowMembersForMessage({ userId, roomId, room, message, requestedFellowId }) {
    const fellowMembers = socialStore.listRoomMembers(roomId)
      .filter((member) => member.member_kind === "fellow" && member.owner_id === userId);
    const enabledFellowMembers = fellowMembers.filter((member) =>
      runtimeBindingsStore.getEnabledBinding(userId, member.member_ref, "cloud-hermes")
    );
    if (requestedFellowId) {
      const fellowMember = fellowMembers.find((member) => member.member_ref === requestedFellowId);
      return fellowMember ? [fellowMember] : [];
    }
    if (room.type === "fellow") return enabledFellowMembers[0] ? [enabledFellowMembers[0]] : [];
    const fellows = fellowsStore.listFellows(userId);
    const directFellowIds = directFellowIdsForMessage(message, enabledFellowMembers, enabledFellowMembers, fellows);
    const directMembers = directFellowIds
      .map((fellowId) => enabledFellowMembers.find((member) => member.member_ref === fellowId))
      .filter(Boolean);
    if (directMembers.length) return directMembers;
    return chooseCloudConductedMembers({ userId, roomId, room, message, enabledFellowMembers, fellows });
  }

  async function runSingleInvocation({ userId, roomId, message, fellowMember }) {
    if (!fellowMember) return null;
    const fellowId = fellowMember.member_ref;
    const binding = runtimeBindingsStore.getEnabledBinding(userId, fellowId, "cloud-hermes");
    if (!binding) return null;
    const runtimeConfig = binding.config || {};
    const fellow = fellowsStore.getFellow(userId, fellowId) || { id: fellowId, name: fellowId };

    const run = cloudAgentRunsStore.createRun({
      userId,
      fellowId,
      roomId,
      triggerMessageId: message.id
    });

    try {
      const worker = await workerManager.ensureWorker(userId);
      const materialized = attachmentMaterializer
        ? attachmentMaterializer.materialize({
          userId,
          workerPaths: worker.paths || {},
          runId: run.id,
          text: message.body_md || "",
          attachments: parseAttachmentsFromMessage(message)
        })
        : { attachments: [], input: message.body_md || "" };
      const result = await hermesRunsClient.runChat({
        baseUrl: worker.baseUrl,
        apiKey: worker.apiKey,
        userId,
        fellow,
        roomId,
        model: runtimeConfig.model || "mia-default",
        effortLevel: runtimeConfig.effortLevel || "medium",
        permissionMode: runtimeConfig.permissionMode || "ask",
        input: materialized.input || message.body_md || "",
        attachments: materialized.attachments || [],
        conversationHistory: conversationHistory(roomId),
        onRunCreated(hermesRunId) {
          cloudAgentRunsStore.markRunning(run.id, hermesRunId || "");
          broadcastTransientEvent(userId, {
            type: "cloud_agent_run_started",
            runId: run.id,
            hermesRunId,
            roomId,
            fellowId,
            triggerMessageId: message.id
          });
        },
        onEvent(event) {
          broadcastTransientEvent(userId, {
            type: "cloud_agent_run_event",
            runId: run.id,
            roomId,
            fellowId,
            event
          });
        }
      });
      const replyAttachments = attachmentMaterializer?.archiveGeneratedAttachments
        ? attachmentMaterializer.archiveGeneratedAttachments({
          userId,
          workerPaths: worker.paths || {},
          result
        })
        : [];
      if (result.runId) cloudAgentRunsStore.markRunning(run.id, result.runId);
      const reply = messagesStore.appendMessage({
        roomId,
        senderKind: "fellow",
        senderRef: fellowId,
        senderOwnerId: userId,
        bodyMd: result.content || "",
        attachments: replyAttachments.length ? replyAttachments : null,
        status: "complete"
      });
      cloudAgentRunsStore.markComplete(run.id);
      for (const member of socialStore.listRoomMembers(roomId)) {
        if (member.member_kind === "user") {
          broadcastPersistedEvent(member.member_ref, { type: "room.message_appended", roomId, message: reply });
        }
      }
      return reply;
    } catch (error) {
      cloudAgentRunsStore.markError(run.id, error);
      return null;
    }
  }

  async function runInvocation(args = {}) {
    const userId = String(args.userId || "").trim();
    const roomId = String(args.roomId || "").trim();
    const requestedFellowId = String(args.fellowId || "").trim();
    const message = args.message || {};
    if (!userId || !roomId || !message.id) return null;
    if (message.sender_kind && message.sender_kind !== "user") return null;
    if (!requestedFellowId && messageHasMentions(message)) return null;

    const room = socialStore.getRoom(roomId);
    if (!room) return null;
    if (room.type === "fellow" && room.decorations?.runtimeKind !== "cloud-hermes") return null;
    const fellowMembers = await selectedFellowMembersForMessage({ userId, roomId, room, message, requestedFellowId });
    if (!fellowMembers.length) return null;
    const replies = [];
    for (const fellowMember of fellowMembers.slice(0, 3)) {
      const reply = await runSingleInvocation({ userId, roomId, message, fellowMember });
      if (reply) replies.push(reply);
    }
    return replies[0] || null;
  }

  async function runUserMessage(args = {}) {
    return runInvocation(args);
  }

  function handleUserMessage(args = {}) {
    const promise = runUserMessage(args);
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
    return promise;
  }

  function invokeFellow(args = {}) {
    const promise = runInvocation(args);
    pending.add(promise);
    promise.finally(() => pending.delete(promise));
    return promise;
  }

  async function idle() {
    while (pending.size) {
      await Promise.allSettled([...pending]);
    }
  }

  return { canHandleFellow, handleUserMessage, invokeFellow, idle };
}

module.exports = { createCloudAgentDispatcher };
