"use strict";

const { MemberKind, SenderKind } = require("./conversation-kinds.js");
const { EngineId, normalizeAgentEngine } = require("./engine-contracts.js");

const SEARCH_INTENT_RE = /(搜|搜索|查一下|查找|找一下|找下|联网|上网|新闻|热点|最新|\bweb\b|\bsearch\b|\bnews\b|\blatest\b|\brecent\b)/iu;
const DEFAULT_DISPATCH_PROMPT = [
  "你正在协调一个多 Fellow 群聊。你的任务：根据最近的群上下文，决定接下来该让哪个或哪几个 Fellow 发言。",
  "",
  "群成员（不含用户自己）：",
  "{{members}}",
  "",
  "群摘要：",
  "{{summary}}",
  "",
  "最近 6 条消息：",
  "{{recent}}",
  "",
  "用户刚发了：",
  "{{userMessage}}",
  "",
  "输出 JSON，仅一行，格式：",
  "{\"speak\": [\"<fellowId>\", ...]}",
  "- 选 0 到 3 个 fellowId",
  "- 选 0 个表示\"暂时没人发言合适\"",
  "- 如果用户只是查岗/问在不在（例如\"有人吗\"、\"在吗\"、\"某个 Fellow 你在吗\"）且没有具体任务，输出 {\"speak\": []}",
  "- 普通打招呼/寒暄（例如\"hello\"、\"嗨\"、\"早\"）不是查岗；如果没有更明确目标，选择 1 个最适合维持对话的 Fellow",
  "- 如果用户点名某个 Fellow，只能选择被点名的 Fellow；不要让其他 Fellow 代答",
  "- 不要解释，只输出 JSON"
].join("\n");

const AVAILABILITY_PINGS = new Set([
  "有人",
  "有人吗",
  "有人么",
  "有人嘛",
  "有人在",
  "有人在吗",
  "有人在么",
  "有人在嘛",
  "有人在不",
  "有人在不在",
  "有人在线吗",
  "有人在线么",
  "有人在线嘛",
  "有人不",
  "在吗",
  "在么",
  "在嘛",
  "在不",
  "在不在",
  "还在吗",
  "还在么",
  "还在嘛",
  "都在吗",
  "都在么",
  "大家在吗",
  "大家在么",
  "还有人吗",
  "还有人么",
  "谁在",
  "谁在吗"
]);

const SHORT_ACKNOWLEDGEMENTS = new Set([
  "好",
  "好吧",
  "好的",
  "好滴",
  "行",
  "行吧",
  "可以",
  "收到",
  "明白",
  "明白了",
  "知道了",
  "了解",
  "了解了",
  "嗯",
  "嗯嗯",
  "恩",
  "恩恩",
  "哦",
  "噢",
  "ok",
  "okay",
  "thanks",
  "thx",
  "谢谢",
  "谢了",
  "辛苦了"
]);

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function messageHasMentions(message = {}) {
  return parseJsonArray(message.mentions).length > 0 || parseJsonArray(message.mentions_json).length > 0;
}

function messageMentionedFellowIds(message = {}) {
  const mentions = [
    ...parseJsonArray(message.mentions),
    ...parseJsonArray(message.mentions_json)
  ];
  const ids = [];
  const seen = new Set();
  for (const mention of mentions) {
    if (!mention || typeof mention !== "object") continue;
    const kind = String(mention.kind || mention.member_kind || "").trim();
    if (kind && kind !== MemberKind.Fellow) continue;
    const fellowId = String(mention.fellowId || mention.fellow_id || mention.member_ref || mention.id || "").trim();
    if (!fellowId || seen.has(fellowId)) continue;
    seen.add(fellowId);
    ids.push(fellowId);
  }
  return ids;
}

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePingText(value) {
  return normalizeComparable(value).replace(/[\s,，.。!！?？~～…:：;；、"'“”‘’()[\]{}（）【】<>《》]/g, "");
}

function fellowForMember(member, fellows) {
  const ref = member?.member_ref;
  return (Array.isArray(fellows) ? fellows : [])
    .find((item) => item?.id === ref || item?.key === ref) || null;
}

function messageAsksForSearch(text) {
  return SEARCH_INTENT_RE.test(String(text || ""));
}

function capabilitySignalsSearch(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.some(capabilitySignalsSearch);
  if (typeof value === "object") {
    return Object.entries(value).some(([key, nested]) => {
      const keyLooksSearch = /search|web|internet/i.test(String(key || ""));
      if (keyLooksSearch && nested !== false && nested != null) return true;
      return capabilitySignalsSearch(nested);
    });
  }
  return /search|web|internet/i.test(String(value || ""));
}

function fellowHasSearchCapability(fellow) {
  if (!fellow) return false;
  if (fellow.canSearch || fellow.webSearchEnabled || fellow.searchEnabled) return true;
  if (capabilitySignalsSearch(fellow.capabilities)) return true;
  const engine = fellow.agentEngine || fellow.agent_engine || fellow.engine || fellow.engineConfig?.agentEngine;
  return normalizeAgentEngine(engine) === EngineId.Codex;
}

function fellowNameCandidates(member, fellows) {
  const fellow = fellowForMember(member, fellows);
  return [
    member?.member_ref,
    member?.fellow_name,
    fellow?.name,
    fellow?.id,
    fellow?.key
  ];
}

function memberRuntimeKind(member = {}) {
  const direct = String(member.runtimeKind || member.runtime_kind || "").trim();
  if (direct === "cloud-hermes" || direct === "desktop-local") return direct;
  const perms = parseJsonObject(member.aiPerms || member.ai_perms || member.ai_perms_json);
  const nested = String(perms?.runtimeKind || perms?.runtime_kind || "").trim();
  if (nested === "cloud-hermes" || nested === "desktop-local") return nested;
  return "";
}

function textNamedFellowIds(text, fellowMembers, fellows) {
  const haystack = normalizeComparable(text);
  if (!haystack) return [];
  const matchedIds = [];
  for (const member of Array.isArray(fellowMembers) ? fellowMembers : []) {
    const matched = fellowNameCandidates(member, fellows).some((candidate) => {
      const needle = normalizeComparable(candidate);
      return needle.length >= 2 && haystack.includes(needle);
    });
    if (matched && member?.member_ref) matchedIds.push(member.member_ref);
  }
  return matchedIds;
}

function textNamesFellow(text, fellowMembers, fellows) {
  return textNamedFellowIds(text, fellowMembers, fellows)[0] || null;
}

function textNamesOwnedFellow(text, ownFellowMembers, fellows) {
  return textNamesFellow(text, ownFellowMembers, fellows);
}

function userNameCandidates(member) {
  const user = member?.user && typeof member.user === "object" ? member.user : null;
  return [
    member?.username,
    member?.displayName,
    member?.display_name,
    member?.name,
    user?.username,
    user?.displayName,
    user?.display_name,
    user?.account,
    user?.name
  ];
}

function textNamedUserIds(text, members) {
  const haystack = normalizeComparable(text);
  if (!haystack) return [];
  const matchedIds = [];
  for (const member of Array.isArray(members) ? members : []) {
    if (member?.member_kind !== MemberKind.User) continue;
    const matched = userNameCandidates(member).some((candidate) => {
      const needle = normalizeComparable(candidate);
      return needle.length >= 2 && haystack.includes(needle);
    });
    if (matched && member?.member_ref) matchedIds.push(member.member_ref);
  }
  return matchedIds;
}

function messageNamesUnavailableFellow(message, fellowMembers, availableFellowMembers, fellows) {
  const namedIds = textNamedFellowIds(message?.body_md || "", fellowMembers, fellows);
  if (!namedIds.length) return false;
  const availableIds = new Set((Array.isArray(availableFellowMembers) ? availableFellowMembers : [])
    .map((member) => member?.member_ref)
    .filter(Boolean));
  return namedIds.every((fellowId) => !availableIds.has(fellowId));
}

function messageNamesHumanMember(message, members, availableFellowMembers, fellows) {
  const text = message?.body_md || "";
  const senderRef = String(message?.sender_ref || "");
  const namedUserIds = textNamedUserIds(text, members)
    .filter((userId) => String(userId) !== senderRef);
  if (!namedUserIds.length) return false;
  return textNamedFellowIds(text, availableFellowMembers, fellows).length === 0;
}

function messageIsAvailabilityPing(text) {
  const normalized = normalizePingText(text);
  if (!normalized) return false;
  if (AVAILABILITY_PINGS.has(normalized)) return true;
  return /^.{1,32}你?(在吗|在么|在嘛|在不在|还在吗|还在么|还在嘛|在线吗|在线么|在线嘛)$/.test(normalized);
}

function messageIsShortAcknowledgement(text) {
  const normalized = normalizePingText(text);
  if (!normalized) return false;
  if (SHORT_ACKNOWLEDGEMENTS.has(normalized)) return true;
  return /^(ok|okay|嗯+|恩+|好+|哦+|噢+)$/.test(normalized);
}

function searchCapableOwnedFellowId(text, ownFellowMembers, fellows) {
  if (!messageAsksForSearch(text)) return null;
  const namedFellowId = textNamesOwnedFellow(text, ownFellowMembers, fellows);
  if (namedFellowId) {
    const namedMember = ownFellowMembers.find((member) => member.member_ref === namedFellowId);
    if (fellowHasSearchCapability(fellowForMember(namedMember, fellows))) return namedFellowId;
  }
  const capableMember = ownFellowMembers.find((member) =>
    fellowHasSearchCapability(fellowForMember(member, fellows))
  );
  return capableMember?.member_ref || null;
}

function directFellowIdsForMessage(message, fellowMembers, ownFellowMembers, fellows) {
  const allFellowMembers = Array.isArray(fellowMembers) ? fellowMembers : [];
  const ownedMembers = Array.isArray(ownFellowMembers) ? ownFellowMembers : [];
  const ownedIds = new Set(ownedMembers.map((member) => member?.member_ref).filter(Boolean));
  const mentionedIds = messageMentionedFellowIds(message).filter((fellowId) => ownedIds.has(fellowId));
  if (mentionedIds.length) return mentionedIds.slice(0, 3);
  if (allFellowMembers.length === 1 && ownedMembers.length === 1) {
    return [ownedMembers[0].member_ref];
  }
  const text = message?.body_md || "";
  const searchFellowId = searchCapableOwnedFellowId(text, ownedMembers, fellows);
  if (searchFellowId) return [searchFellowId];
  const namedFellowId = textNamesOwnedFellow(text, ownedMembers, fellows);
  return namedFellowId ? [namedFellowId] : [];
}

function fillTemplate(template, vars) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ""
  );
}

function formatDispatchMembers(members) {
  return members.map((member) => `- ${member.name} (id=${member.id})`).join("\n");
}

function formatDispatchMessages(messages, fellowNamesById = {}) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (message.sender_kind === SenderKind.User) {
      return `${message.sender_username || message.sender_ref || "用户"}: ${message.body_md || ""}`;
    }
    const name = fellowNamesById[message.sender_ref] || message.sender_ref || "Fellow";
    return `${name}: ${message.body_md || ""}`;
  }).join("\n");
}

function buildDispatchPrompt(template, ctx) {
  return fillTemplate(template || DEFAULT_DISPATCH_PROMPT, {
    members: formatDispatchMembers(ctx.members || []),
    summary: ctx.summary || "（暂无摘要）",
    recent: formatDispatchMessages(ctx.recentMessages, ctx.fellowNamesById || {}),
    userMessage: ctx.userMessage || ""
  });
}

function parseDispatchSpeak(text) {
  const decision = parseDispatchDecision(text);
  return decision ? decision.speak : [];
}

function parseDispatchDecision(text) {
  if (!text || typeof text !== "string") return null;
  try {
    const match = text.match(/\{[^}]*"speak"[^}]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    return Array.isArray(parsed?.speak)
      ? { speak: parsed.speak.map((item) => String(item || "").trim()).filter(Boolean) }
      : null;
  } catch {
    return null;
  }
}

module.exports = {
  DEFAULT_DISPATCH_PROMPT,
  buildDispatchPrompt,
  directFellowIdsForMessage,
  fellowForMember,
  fellowHasSearchCapability,
  messageIsAvailabilityPing,
  messageIsShortAcknowledgement,
  messageNamesHumanMember,
  messageNamesUnavailableFellow,
  messageHasMentions,
  messageMentionedFellowIds,
  memberRuntimeKind,
  parseDispatchDecision,
  parseDispatchSpeak,
  searchCapableOwnedFellowId,
  textNamesFellow,
  textNamesOwnedFellow
};
