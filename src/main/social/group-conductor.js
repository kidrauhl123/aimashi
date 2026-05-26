"use strict";

const { MemberKind, SenderKind } = require("../../shared/conversation-kinds.js");
const {
  directFellowIdsForMessage,
  fellowForMember,
  messageHasMentions
} = require("../../shared/group-fellow-routing.js");
const { buildInvocation } = require("./fellow-invocation.js");

const PROCESSED_CAP = 500;

function fillTemplate(template, vars) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ""
  );
}

function formatMembers(members) {
  return members.map((member) => `- ${member.name} (id=${member.id})`).join("\n");
}

function formatMessages(messages, fellowNamesById) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (message.sender_kind === SenderKind.User) {
      return `${message.sender_username || message.sender_ref || "用户"}: ${message.body_md || ""}`;
    }
    const name = fellowNamesById[message.sender_ref] || message.sender_ref || "Fellow";
    return `${name}: ${message.body_md || ""}`;
  }).join("\n");
}

function buildDispatchPrompt(template, ctx) {
  return fillTemplate(template, {
    members: formatMembers(ctx.members),
    summary: ctx.summary || "（暂无摘要）",
    recent: formatMessages(ctx.recentMessages, ctx.fellowNamesById),
    userMessage: ctx.userMessage || ""
  });
}

function safeParseJSON(text) {
  if (!text || typeof text !== "string") return null;
  try {
    const match = text.match(/\{[^}]*"speak"[^}]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

function inferRoomType(room) {
  if (!room) return null;
  if (room.type) return room.type;
  if (room.id?.startsWith("dm:")) return "dm";
  if (room.id?.startsWith("fellow:")) return "fellow";
  if (room.id?.startsWith("g_") || room.id?.startsWith("g-")) return "group";
  return null;
}

function responseModeFor(room) {
  return room?.decorations?.responseMode === "mentions-only" ? "mentions-only" : "conductor";
}

function hostFellowIdFor(room, ownFellowMembers, fellowMembers = []) {
  const explicit = room?.decorations?.hostMember || room?.hostMember;
  if (explicit && explicit.kind === MemberKind.Fellow && explicit.fellowId) return explicit.fellowId;
  if (fellowMembers.some((member) => !ownFellowMembers.includes(member))) return null;
  return ownFellowMembers[0]?.member_ref || null;
}

function normalizeMessages(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.messages)) return result.messages;
  return [];
}

function createMainGroupConductor({
  getCurrentUserId,
  listFellows,
  loadPrompts,
  getRoomDetails,
  listRecentMessages,
  sendChatStateless,
  responder,
  log = () => {}
}) {
  const processedReplies = new Set();
  const completedMessages = new Set();

  function replyKey(messageId, fellowId) {
    return `${messageId}:${fellowId}`;
  }

  function markProcessedReply(messageId, fellowId) {
    processedReplies.add(replyKey(messageId, fellowId));
    if (processedReplies.size > PROCESSED_CAP) processedReplies.delete(processedReplies.values().next().value);
  }

  function markMessageComplete(messageId) {
    completedMessages.add(messageId);
    if (completedMessages.size > PROCESSED_CAP) completedMessages.delete(completedMessages.values().next().value);
  }

  async function handleRoomMessageAppended(payload) {
    const { roomId, message } = payload || {};
    if (!roomId || !message?.id) return;
    if (message.sender_kind !== SenderKind.User) return;
    if (messageHasMentions(message)) return;
    if (completedMessages.has(message.id)) return;

    const userId = getCurrentUserId();
    if (!userId) return;

    let details;
    try {
      details = await getRoomDetails(roomId);
    } catch (error) {
      log(`[main-group-conductor] get room failed: ${error?.message || error}`);
      return;
    }
    const room = details?.room || details;
    if (inferRoomType(room) !== "group") return;
    if (responseModeFor(room) !== "conductor") return;

    const members = Array.isArray(details?.members) ? details.members : [];
    const fellowMembers = members.filter((member) => member.member_kind === MemberKind.Fellow);
    const ownFellowMembers = fellowMembers.filter((member) => member.owner_id === userId);
    if (!ownFellowMembers.length) return;

    const hostFellowId = hostFellowIdFor(room, ownFellowMembers, fellowMembers);
    const hostMember = fellowMembers.find((member) => member.member_ref === hostFellowId);
    if (!hostMember || hostMember.owner_id !== userId) return;

    const fellowList = listFellows();
    const fellows = Array.isArray(fellowList) ? fellowList : [];
    const fellowNamesById = {};
    const memberDescriptors = fellowMembers.map((member) => {
      const fellow = fellowForMember(member, fellows);
      const name = fellow?.name || member.fellow_name || member.member_ref;
      fellowNamesById[member.member_ref] = name;
      return { id: member.member_ref, name };
    });
    const sinceSeq = Math.max(0, Number(message.seq || 0) - 6);
    const recentMessages = normalizeMessages(await listRecentMessages(roomId, sinceSeq, 6));

    const respondToChosen = async (chosen) => {
      let pending = 0;
      let failed = 0;
      for (const fellowId of chosen) {
        const member = fellowMembers.find((item) => item.member_ref === fellowId);
        if (!member || member.owner_id !== userId) continue;
        if (processedReplies.has(replyKey(message.id, fellowId))) continue;
        const args = buildInvocation({
          roomId,
          fellowId,
          invokedBy: { username: "conductor" },
          triggeringMessage: message,
          recentMessages
        }, fellows);
        if (args) {
          pending += 1;
          const didRespond = await responder.respond(args);
          if (didRespond) markProcessedReply(message.id, fellowId);
          else failed += 1;
        }
      }
      if (pending > 0 && !failed) markMessageComplete(message.id);
      return { pending, failed };
    };

    const directChosen = directFellowIdsForMessage(message, fellowMembers, ownFellowMembers, fellows);
    if (directChosen.length) {
      await respondToChosen(directChosen);
      return;
    }

    let prompts;
    try {
      prompts = await loadPrompts();
    } catch (error) {
      log(`[main-group-conductor] load prompts failed: ${error?.message || error}`);
      return;
    }
    if (!prompts?.dispatch) return;

    const dispatchPrompt = buildDispatchPrompt(prompts.dispatch, {
      members: memberDescriptors,
      summary: room.contextCard?.summary || room.decorations?.pinnedGoal || null,
      recentMessages,
      fellowNamesById,
      userMessage: message.body_md || ""
    });

    let raw = "";
    try {
      const result = await sendChatStateless({
        fellowKey: hostFellowId,
        systemPrompt: "你是群聊调度器，无人设。",
        userPrompt: dispatchPrompt
      });
      raw = result && typeof result.content === "string" ? result.content : "";
    } catch (error) {
      log(`[main-group-conductor] dispatch failed: ${error?.message || error}`);
      return;
    }

    const parsed = safeParseJSON(raw);
    const suggested = Array.isArray(parsed?.speak) ? parsed.speak : [];
    const chosen = suggested.length ? suggested : [hostFellowId];
    const result = await respondToChosen(chosen);
    if (result.pending === 0 && result.failed === 0 && !chosen.includes(hostFellowId)) {
      await respondToChosen([hostFellowId]);
    }
  }

  return { handleRoomMessageAppended };
}

module.exports = {
  createMainGroupConductor,
  buildDispatchPrompt,
  hostFellowIdFor,
  messageHasMentions
};
