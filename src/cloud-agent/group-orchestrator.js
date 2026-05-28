"use strict";

const {
  DEFAULT_DISPATCH_PROMPT,
  buildDispatchPrompt,
  directFellowIdsForMessage,
  fellowForMember,
  parseDispatchSpeak
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

function uniqueFellowsForMembers(fellowsStore, fellowMembers) {
  const fellows = [];
  const seen = new Set();
  for (const member of fellowMembers) {
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

function membersByFellowId(fellowMembers) {
  const map = new Map();
  for (const member of fellowMembers) {
    if (member?.member_ref) map.set(member.member_ref, member);
  }
  return map;
}

function pickMembers(fellowMembers, fellowIds) {
  const map = membersByFellowId(fellowMembers);
  const chosen = [];
  const seen = new Set();
  for (const fellowId of fellowIds) {
    if (!fellowId || seen.has(fellowId)) continue;
    const member = map.get(fellowId);
    if (!member) continue;
    seen.add(fellowId);
    chosen.push(member);
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
  workerManager,
  hermesRunsClient,
  loadPrompts = async () => ({ dispatch: DEFAULT_DISPATCH_PROMPT }),
  getUserPublic = () => null,
  log = () => {}
}) {
  async function runConductor({ userId, conversationId, conversation, message, fellowMembers, fellows, recentMessages }) {
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
      return parseDispatchSpeak(result.content || "");
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
    const recentMessages = recentMessagesForDispatch(messagesStore, conversationId, message);
    const context = { members, fellows, recentMessages };

    if (!fellowMembers.length) return { chosen: [], ...context };

    if (requestedFellowId) {
      return { chosen: pickMembers(fellowMembers, [requestedFellowId]), ...context };
    }

    if (fellowMembers.length === 1) {
      return { chosen: [fellowMembers[0]], ...context };
    }

    const directIds = directFellowIdsForMessage(message, fellowMembers, fellows);
    if (directIds.length) {
      return { chosen: pickMembers(fellowMembers, directIds), ...context };
    }

    const spoken = await runConductor({
      userId,
      conversationId,
      conversation,
      message,
      fellowMembers,
      fellows,
      recentMessages
    });
    const chosenByLlm = pickMembers(fellowMembers, spoken);
    if (chosenByLlm.length) return { chosen: chosenByLlm, ...context };

    // Conductor returned nothing usable — let the first fellow keep the conversation alive.
    return { chosen: [fellowMembers[0]], ...context };
  }

  return { chooseTargets };
}

module.exports = {
  ORCHESTRATOR_FELLOW,
  createGroupOrchestrator
};
