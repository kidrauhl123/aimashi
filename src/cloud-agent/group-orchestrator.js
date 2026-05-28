"use strict";

const {
  DEFAULT_DISPATCH_PROMPT,
  buildDispatchPrompt,
  directFellowIdsForMessage,
  fellowForMember,
  memberRuntimeKind,
  messageIsAvailabilityPing,
  messageIsShortAcknowledgement,
  messageNamesHumanMember,
  messageNamesUnavailableFellow,
  parseDispatchDecision
} = require("../shared/group-fellow-routing.js");
const { MemberKind } = require("../shared/conversation-kinds.js");

const ORCHESTRATOR_FELLOW = Object.freeze({
  id: "group-orchestrator",
  key: "group-orchestrator",
  name: "Group Orchestrator",
  personaText: ""
});

function normalizeMessages(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.messages)) return result.messages;
  return [];
}

function bindingConfig(binding) {
  return binding?.config && typeof binding.config === "object" ? binding.config : {};
}

function runtimeTargetForMember(runtimeBindingsStore, member) {
  if (!member?.member_ref || !member?.owner_id) return null;
  const fellowId = member.member_ref;
  const ownerId = member.owner_id;
  const explicitRuntimeKind = memberRuntimeKind(member);
  if (explicitRuntimeKind === "desktop-local") {
    const binding = runtimeBindingsStore.getEnabledBinding(ownerId, fellowId, "desktop-local");
    return { member, fellowId, ownerId, runtimeKind: "desktop-local", binding, runtimeConfig: bindingConfig(binding) };
  }
  if (explicitRuntimeKind === "cloud-hermes") {
    const binding = runtimeBindingsStore.getEnabledBinding(ownerId, fellowId, "cloud-hermes");
    return binding ? { member, fellowId, ownerId, runtimeKind: "cloud-hermes", binding, runtimeConfig: bindingConfig(binding) } : null;
  }
  const cloudBinding = runtimeBindingsStore.getEnabledBinding(ownerId, fellowId, "cloud-hermes");
  if (cloudBinding) {
    return { member, fellowId, ownerId, runtimeKind: "cloud-hermes", binding: cloudBinding, runtimeConfig: bindingConfig(cloudBinding) };
  }
  const desktopBinding = runtimeBindingsStore.getEnabledBinding(ownerId, fellowId, "desktop-local");
  if (desktopBinding) {
    return { member, fellowId, ownerId, runtimeKind: "desktop-local", binding: desktopBinding, runtimeConfig: bindingConfig(desktopBinding) };
  }
  return { member, fellowId, ownerId, runtimeKind: "desktop-local", binding: null, runtimeConfig: {} };
}

function uniqueFellowsForMembers(fellowsStore, fellowMembers) {
  const fellows = [];
  const seen = new Set();
  for (const member of Array.isArray(fellowMembers) ? fellowMembers : []) {
    const ownerId = String(member?.owner_id || "");
    const fellowId = String(member?.member_ref || "");
    const key = `${ownerId}:${fellowId}`;
    if (!ownerId || !fellowId || seen.has(key)) continue;
    seen.add(key);
    const fellow = fellowsStore.getFellow(ownerId, fellowId);
    if (fellow) fellows.push({ ...fellow, key: fellow.id });
  }
  return fellows;
}

function enrichUserMembers(members, getUserPublic) {
  return (Array.isArray(members) ? members : []).map((member) => {
    if (member?.member_kind !== MemberKind.User || member.user) return member;
    const user = getUserPublic(member.member_ref);
    return user ? { ...member, user } : member;
  });
}

function recentMessagesForDispatch(messagesStore, conversationId, message) {
  const sinceSeq = Math.max(0, Number(message?.seq || 0) - 6);
  return normalizeMessages(messagesStore.listMessagesSince(conversationId, sinceSeq, 6));
}

function memberDescriptors(fellowMembers, fellows) {
  return fellowMembers.map((member) => {
    const fellow = fellowForMember(member, fellows);
    return {
      id: member.member_ref,
      name: fellow?.name || member.fellow_name || member.member_ref
    };
  });
}

function fellowNamesById(fellowMembers, fellows) {
  const names = {};
  for (const member of fellowMembers) {
    const fellow = fellowForMember(member, fellows);
    names[member.member_ref] = fellow?.name || member.fellow_name || member.member_ref;
  }
  return names;
}

function targetsForIds(targets, fellowIds) {
  const byId = new Map(targets.map((target) => [target.fellowId, target]));
  const chosen = [];
  const seen = new Set();
  for (const fellowId of fellowIds) {
    const target = byId.get(fellowId);
    if (!target || seen.has(fellowId)) continue;
    seen.add(fellowId);
    chosen.push(target);
    if (chosen.length >= 3) break;
  }
  return chosen;
}

function conductorSessionId(userId, conversationId, messageId) {
  return `cloud:${userId}:group-orchestrator:${conversationId}:${messageId}`;
}

function createGroupOrchestrator({
  socialStore,
  messagesStore,
  fellowsStore,
  runtimeBindingsStore,
  workerManager,
  hermesRunsClient,
  loadPrompts = async () => ({ dispatch: DEFAULT_DISPATCH_PROMPT }),
  getUserPublic = () => null,
  log = () => {}
}) {
  async function runConductor({ userId, conversationId, conversation, message, fellowMembers, targets, fellows, recentMessages }) {
    if (!targets.length) return [];
    const prompts = await loadPrompts().catch((error) => {
      log(`[group-orchestrator] load conductor prompts failed: ${error?.message || error}`);
      return null;
    });
    const template = prompts?.dispatch || DEFAULT_DISPATCH_PROMPT;
    const dispatchPrompt = buildDispatchPrompt(template, {
      members: memberDescriptors(fellowMembers, fellows),
      summary: conversation.contextCard?.summary || conversation.decorations?.pinnedGoal || null,
      recentMessages,
      fellowNamesById: fellowNamesById(fellowMembers, fellows),
      userMessage: message.body_md || ""
    });
    try {
      const worker = await workerManager.ensureWorker(userId);
      const result = await hermesRunsClient.runChat({
        baseUrl: worker.baseUrl,
        apiKey: worker.apiKey,
        userId,
        fellow: ORCHESTRATOR_FELLOW,
        conversationId,
        sessionId: conductorSessionId(userId, conversationId, message.id),
        metadataRole: "group-conductor",
        model: "mia-default",
        effortLevel: "medium",
        permissionMode: "ask",
        input: dispatchPrompt,
        attachments: [],
        conversationHistory: []
      });
      const decision = parseDispatchDecision(result.content || "");
      return decision ? targetsForIds(targets, decision.speak) : [];
    } catch (error) {
      log(`[group-orchestrator] conductor dispatch failed: ${error?.message || error}`);
      return [];
    }
  }

  async function chooseTargets({ userId, conversationId, conversation, message, requestedFellowId = "" }) {
    if (!conversation || conversation.type !== "group") return null;
    const members = enrichUserMembers(socialStore.listConversationMembers(conversationId), getUserPublic);
    const fellowMembers = members.filter((member) => member.member_kind === MemberKind.Fellow);
    const fellows = uniqueFellowsForMembers(fellowsStore, fellowMembers);
    const targets = fellowMembers
      .map((member) => runtimeTargetForMember(runtimeBindingsStore, member))
      .filter(Boolean);
    const recentMessages = recentMessagesForDispatch(messagesStore, conversationId, message);
    if (!targets.length) return { targets: [], members, fellows, recentMessages };

    if (requestedFellowId) {
      return {
        targets: targetsForIds(targets, [requestedFellowId]),
        members,
        fellows,
        recentMessages
      };
    }

    const runnableMembers = targets.map((target) => target.member);
    if (messageNamesUnavailableFellow(message, fellowMembers, runnableMembers, fellows)) {
      return { targets: [], members, fellows, recentMessages };
    }
    if (messageNamesHumanMember(message, members, runnableMembers, fellows)) {
      return { targets: [], members, fellows, recentMessages };
    }
    if (messageIsAvailabilityPing(message.body_md || "")) {
      return { targets: [], members, fellows, recentMessages };
    }
    if (messageIsShortAcknowledgement(message.body_md || "")) {
      return { targets: [], members, fellows, recentMessages };
    }

    const directIds = directFellowIdsForMessage(message, fellowMembers, runnableMembers, fellows);
    if (directIds.length) {
      return { targets: targetsForIds(targets, directIds), members, fellows, recentMessages };
    }

    const conductedTargets = await runConductor({
      userId,
      conversationId,
      conversation,
      message,
      fellowMembers,
      targets,
      fellows,
      recentMessages
    });
    return { targets: conductedTargets, members, fellows, recentMessages };
  }

  return { chooseTargets };
}

module.exports = {
  ORCHESTRATOR_FELLOW,
  createGroupOrchestrator,
  runtimeTargetForMember
};
