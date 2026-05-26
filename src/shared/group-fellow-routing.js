"use strict";

const { EngineId, normalizeAgentEngine } = require("./engine-contracts.js");

const SEARCH_INTENT_RE = /(搜|搜索|查一下|查找|找一下|找下|联网|上网|新闻|热点|最新|\bweb\b|\bsearch\b|\bnews\b|\blatest\b|\brecent\b)/iu;

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

function messageHasMentions(message = {}) {
  return parseJsonArray(message.mentions).length > 0 || parseJsonArray(message.mentions_json).length > 0;
}

function normalizeComparable(value) {
  return String(value || "").trim().toLowerCase();
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

function textNamesOwnedFellow(text, ownFellowMembers, fellows) {
  const haystack = normalizeComparable(text);
  if (!haystack) return null;
  for (const member of Array.isArray(ownFellowMembers) ? ownFellowMembers : []) {
    const fellow = fellowForMember(member, fellows);
    const candidates = [
      member.member_ref,
      member.fellow_name,
      fellow?.name,
      fellow?.id,
      fellow?.key
    ];
    const matched = candidates.some((candidate) => {
      const needle = normalizeComparable(candidate);
      return needle.length >= 2 && haystack.includes(needle);
    });
    if (matched) return member.member_ref;
  }
  return null;
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
  if (allFellowMembers.length === 1 && ownedMembers.length === 1) {
    return [ownedMembers[0].member_ref];
  }
  const text = message?.body_md || "";
  const searchFellowId = searchCapableOwnedFellowId(text, ownedMembers, fellows);
  if (searchFellowId) return [searchFellowId];
  const namedFellowId = textNamesOwnedFellow(text, ownedMembers, fellows);
  return namedFellowId ? [namedFellowId] : [];
}

module.exports = {
  directFellowIdsForMessage,
  fellowForMember,
  fellowHasSearchCapability,
  messageHasMentions,
  searchCapableOwnedFellowId,
  textNamesOwnedFellow
};
