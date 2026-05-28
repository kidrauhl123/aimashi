const { parseAttachmentsFromMessage } = require("./attachment-materializer.js");
const { fellowForMember } = require("../shared/group-fellow-routing.js");
const { createGroupOrchestrator } = require("./group-orchestrator.js");

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
    : undefined;
  const getUserPublic = typeof deps.getUserPublic === "function" ? deps.getUserPublic : () => null;
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const pending = new Set();
  const groupOrchestrator = createGroupOrchestrator({
    socialStore,
    messagesStore,
    fellowsStore,
    runtimeBindingsStore,
    workerManager,
    hermesRunsClient,
    ...(loadPrompts ? { loadPrompts } : {}),
    getUserPublic,
    log
  });

  function conversationHistory(conversationId) {
    return messagesStore.listMessagesSince(conversationId, 0, 200).map((row) => ({
      role: messageRole(row),
      content: row.body_md || ""
    }));
  }

  function memberDisplayName(member, fellows) {
    if (member?.member_kind === "fellow") {
      const fellow = fellowForMember(member, fellows);
      return fellow?.name || member.fellow_name || member.member_ref || "Fellow";
    }
    const user = member?.user && typeof member.user === "object" ? member.user : null;
    return member?.username || member?.displayName || member?.display_name || user?.username || user?.displayName || member?.member_ref || "用户";
  }

  function groupRoster(members, fellows) {
    return (Array.isArray(members) ? members : [])
      .map((member) => {
        const kind = member?.member_kind === "fellow" ? "fellow" : "user";
        return `- ${memberDisplayName(member, fellows)} (${kind}:${member?.member_ref || ""})`;
      })
      .join("\n");
  }

  function inputWithGroupRoster(input, members, fellows, fellow) {
    const roster = groupRoster(members, fellows);
    if (!roster) return input;
    const displayName = String(fellow?.name || fellow?.displayName || fellow?.display_name || fellow?.id || fellow?.key || "Fellow").trim();
    return [
      `你是 ${displayName}，正在一个多 Fellow 群聊中发言。`,
      "群里的其他 Fellow 和你是同类成员，只是名字、人设、能力不同；不要说这里只有你，也不要否认群成员名单里的人。",
      `群成员：\n${roster}`,
      `用户消息：\n${input || ""}`
    ].join("\n\n");
  }

  function canHandleFellow(args = {}) {
    const userId = String(args.userId || "").trim();
    const fellowId = String(args.fellowId || "").trim();
    if (!userId || !fellowId) return false;
    return Boolean(runtimeBindingsStore.getEnabledBinding(userId, fellowId, "cloud-hermes"));
  }

  function eventType(event = {}) {
    return String(event.type || event.event || "");
  }

  function eventText(event = {}) {
    for (const key of ["reasoning", "delta", "content_delta", "text_delta", "text", "content", "final_response"]) {
      if (typeof event[key] === "string") return event[key];
    }
    const data = event.data && typeof event.data === "object" ? event.data : null;
    return data ? eventText(data) : "";
  }

  function createTraceCollector() {
    const trace = {
      reasoning: "",
      tools: []
    };

    function collect(event = {}) {
      const name = eventType(event);
      if (name === "reasoning.available" || name === "reasoning_delta") {
        trace.reasoning += eventText(event);
        if (trace.reasoning && !trace.reasoning.endsWith("\n")) trace.reasoning += "\n";
        return;
      }
      if (name === "tool.started" || name === "tool_call_started") {
        trace.tools.push({
          id: String(event.id || `tool_${trace.tools.length}`),
          name: String(event.tool || event.name || event.data?.tool || "工具"),
          preview: String(event.preview || event.input || ""),
          status: "running",
          duration: null,
          error: false
        });
        return;
      }
      if (name === "tool.delta" || name === "tool_call_delta") {
        const id = String(event.id || "");
        const toolName = String(event.tool || event.name || event.data?.tool || "");
        const tool = [...trace.tools].reverse().find((item) => (id && item.id === id) || (!id && (!toolName || item.name === toolName) && item.status === "running"));
        if (tool) tool.preview = String(event.preview || event.delta || tool.preview || "");
        return;
      }
      if (name === "tool.completed" || name === "tool_call_completed") {
        const id = String(event.id || "");
        const toolName = String(event.tool || event.name || event.data?.tool || "");
        const tool = [...trace.tools].reverse().find((item) => (id && item.id === id) || (!id && (!toolName || item.name === toolName) && item.status === "running"));
        if (tool) {
          tool.status = event.error || event.data?.error ? "error" : "completed";
          tool.duration = typeof event.duration === "number" ? event.duration : null;
          tool.error = Boolean(event.error || event.data?.error);
          if (event.preview) tool.preview = String(event.preview);
        }
      }
    }

    function payload() {
      const reasoning = String(trace.reasoning || "").trim();
      const tools = trace.tools.filter((tool) => tool.name);
      if (!reasoning && !tools.length) return null;
      return {
        ...(reasoning ? { reasoning } : {}),
        ...(tools.length ? { tools } : {})
      };
    }

    return { collect, payload };
  }

  function enrichUserMembers(members) {
    return (Array.isArray(members) ? members : []).map((member) => {
      if (member?.member_kind !== "user" || member.user) return member;
      const user = getUserPublic(member.member_ref);
      return user ? { ...member, user } : member;
    });
  }

  function invocationSender(message, fallbackUserId) {
    const senderRef = String(message?.sender_ref || fallbackUserId || "").trim();
    return getUserPublic(senderRef) || (senderRef ? { id: senderRef } : null);
  }

  function broadcastDesktopInvocation({ target, conversationId, message, members, recentMessages }) {
    if (!target || target.runtimeKind !== "desktop-local") return false;
    broadcastPersistedEvent(target.ownerId, {
      type: "conversation.fellow_invocation_requested",
      conversationId,
      fellowId: target.fellowId,
      runtimeKind: "desktop-local",
      runtimeConfig: target.runtimeConfig || {},
      invokedBy: invocationSender(message, target.ownerId),
      triggeringMessage: message,
      recentMessages,
      members
    });
    return true;
  }

  async function runSingleInvocation({ userId, conversationId, message, fellowMember, target, members = null, fellows = null }) {
    const fellowId = target?.fellowId || fellowMember?.member_ref;
    const ownerId = target?.ownerId || userId;
    if (!fellowId || !ownerId) return null;
    const binding = target?.binding || runtimeBindingsStore.getEnabledBinding(ownerId, fellowId, "cloud-hermes");
    if (!binding) return null;
    const runtimeConfig = target?.runtimeConfig || binding.config || {};
    const fellow = fellowsStore.getFellow(ownerId, fellowId) || { id: fellowId, name: fellowId };
    const rosterMembers = Array.isArray(members) ? members : enrichUserMembers(socialStore.listConversationMembers(conversationId));
    const rosterFellows = Array.isArray(fellows) ? fellows : fellowsStore.listFellows(ownerId);
    const trace = createTraceCollector();

    const run = cloudAgentRunsStore.createRun({
      userId: ownerId,
      fellowId,
      conversationId,
      triggerMessageId: message.id
    });

    try {
      const worker = await workerManager.ensureWorker(ownerId);
      const materialized = attachmentMaterializer
        ? attachmentMaterializer.materialize({
          userId: ownerId,
          workerPaths: worker.paths || {},
          runId: run.id,
          text: message.body_md || "",
          attachments: parseAttachmentsFromMessage(message)
        })
        : { attachments: [], input: message.body_md || "" };
      const result = await hermesRunsClient.runChat({
        baseUrl: worker.baseUrl,
        apiKey: worker.apiKey,
        userId: ownerId,
        fellow,
        conversationId,
        model: runtimeConfig.model || "mia-default",
        effortLevel: runtimeConfig.effortLevel || "medium",
        permissionMode: runtimeConfig.permissionMode || "ask",
        input: inputWithGroupRoster(materialized.input || message.body_md || "", rosterMembers, rosterFellows, fellow),
        attachments: materialized.attachments || [],
        conversationHistory: conversationHistory(conversationId),
        onRunCreated(hermesRunId) {
          cloudAgentRunsStore.markRunning(run.id, hermesRunId || "");
          broadcastTransientEvent(ownerId, {
            type: "cloud_agent_run_started",
            runId: run.id,
            hermesRunId,
            conversationId,
            fellowId,
            triggerMessageId: message.id
          });
        },
        onEvent(event) {
          trace.collect(event);
          broadcastTransientEvent(ownerId, {
            type: "cloud_agent_run_event",
            runId: run.id,
            conversationId,
            fellowId,
            event
          });
        }
      });
      const replyAttachments = attachmentMaterializer?.archiveGeneratedAttachments
        ? attachmentMaterializer.archiveGeneratedAttachments({
          userId: ownerId,
          workerPaths: worker.paths || {},
          result
        })
        : [];
      if (result.runId) cloudAgentRunsStore.markRunning(run.id, result.runId);
      const reply = messagesStore.appendMessage({
        conversationId,
        senderKind: "fellow",
        senderRef: fellowId,
        senderOwnerId: ownerId,
        bodyMd: result.content || "",
        attachments: replyAttachments.length ? replyAttachments : null,
        trace: trace.payload(),
        status: "complete"
      });
      cloudAgentRunsStore.markComplete(run.id);
      for (const member of socialStore.listConversationMembers(conversationId)) {
        if (member.member_kind === "user") {
          broadcastPersistedEvent(member.member_ref, { type: "conversation.message_appended", conversationId, message: reply });
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
    const conversationId = String(args.conversationId || "").trim();
    const requestedFellowId = String(args.fellowId || "").trim();
    const message = args.message || {};
    if (!userId || !conversationId || !message.id) return null;
    if (message.sender_kind && message.sender_kind !== "user") return null;

    const conversation = socialStore.getConversation(conversationId);
    if (!conversation) return null;
    if (conversation.type === "fellow" && conversation.decorations?.runtimeKind !== "cloud-hermes") return null;
    if (conversation.type === "group") {
      const decision = await groupOrchestrator.chooseTargets({ userId, conversationId, conversation, message, requestedFellowId });
      const targets = decision?.targets || [];
      if (!targets.length) return null;
      const replies = [];
      for (const target of targets.slice(0, 3)) {
        if (target.runtimeKind === "desktop-local") {
          broadcastDesktopInvocation({
            target,
            conversationId,
            message,
            members: decision.members || [],
            recentMessages: decision.recentMessages || []
          });
          continue;
        }
        const reply = await runSingleInvocation({
          userId: target.ownerId,
          conversationId,
          message,
          target,
          members: decision.members || [],
          fellows: decision.fellows || []
        });
        if (reply) replies.push(reply);
      }
      return replies[0] || null;
    }
    const fellowMembers = enrichUserMembers(socialStore.listConversationMembers(conversationId))
      .filter((member) => member.member_kind === "fellow" && member.owner_id === userId);
    const fellowMember = requestedFellowId
      ? fellowMembers.find((member) => member.member_ref === requestedFellowId)
      : fellowMembers[0];
    if (!fellowMember) return null;
    return runSingleInvocation({ userId, conversationId, message, fellowMember });
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
