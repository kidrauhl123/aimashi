"use strict";

const { MemberKind, SenderKind } = require("../../shared/conversation-kinds.js");
const { activeSkillIdsFromMessage } = require("./local-fellow-responder.js");

function contextLines(recentMessages) {
  return (Array.isArray(recentMessages) ? recentMessages : [])
    .map((message) => {
      const senderKind = String(message?.sender_kind || "");
      const senderRef = String(message?.sender_ref || "");
      const tag = senderKind === SenderKind.Fellow
        ? `fellow:${senderRef}`
        : (senderKind === SenderKind.System ? "system" : `user:${senderRef}`);
      return `[${tag}] ${message?.body_md || ""}`;
    })
    .join("\n");
}

function memberName(member, fellows) {
  if (member?.member_kind === MemberKind.Fellow) {
    const fellow = (Array.isArray(fellows) ? fellows : [])
      .find((item) => (item.key || item.id) === member.member_ref);
    return fellow?.name || member.fellow_name || member.member_ref || "Fellow";
  }
  const user = member?.user && typeof member.user === "object" ? member.user : null;
  return member?.username || member?.displayName || member?.display_name || user?.username || user?.displayName || member?.member_ref || "用户";
}

function memberLines(members, fellows) {
  return (Array.isArray(members) ? members : [])
    .map((member) => {
      const kind = member?.member_kind === MemberKind.Fellow ? MemberKind.Fellow : MemberKind.User;
      return `- ${memberName(member, fellows)} (${kind}:${member?.member_ref || ""})`;
    })
    .join("\n");
}

function buildInvocation(payload, fellows) {
  const { conversationId, fellowId, triggeringMessage, recentMessages, members, runtimeConfig } = payload || {};
  const triggerId = triggeringMessage && triggeringMessage.id;
  if (!conversationId || !fellowId || !triggerId) return null;
  const fellow = (Array.isArray(fellows) ? fellows : []).find((item) => (item.key || item.id) === fellowId);
  if (!fellow) return null;

  const roster = memberLines(members, fellows);
  return {
    conversationId,
    fellowId,
    dedupKey: `${triggerId}:${fellowId}`,
    systemPrompt: [
      `你是 ${fellow.name || fellowId}，正在一个群聊里。`,
      roster ? `群成员：\n${roster}` : "",
      `最近的消息上下文：\n${contextLines(recentMessages)}`,
      "请用自然的口吻接话，简短直接。"
    ].filter(Boolean).join("\n\n"),
    userPrompt: triggeringMessage.body_md || "",
    runtimeConfig: runtimeConfig && typeof runtimeConfig === "object" ? runtimeConfig : null,
    turnId: triggeringMessage.turn_id || null,
    activeSkillIds: activeSkillIdsFromMessage(triggeringMessage)
  };
}

module.exports = { buildInvocation };
