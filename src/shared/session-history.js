(function attachSessionHistory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaSessionHistory = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function buildSessionHistory() {
  function roomType(room, roomId = "") {
    const id = String(roomId || room?.id || "");
    return room?.type
      || (id.startsWith("dm:") ? "dm"
        : id.startsWith("fellow:") ? "fellow"
        : (id.startsWith("g_") || id.startsWith("g-")) ? "group"
        : "");
  }

  function fellowKey(room) {
    const decorated = room?.decorations?.fellowKey || room?.fellowKey || room?.fellow_id || "";
    if (decorated) return String(decorated);
    const id = String(room?.id || "");
    return id.startsWith("fellow:") ? id.split(":").slice(2).join(":") : "";
  }

  function runtimeKind(room, fallback = "desktop-local") {
    return String(room?.decorations?.runtimeKind || "").trim() || fallback;
  }

  function roomSortTime(room, messageCache) {
    const cache = messageCache?.get?.(room?.id);
    const last = cache?.messages?.[cache.messages.length - 1];
    return new Date(
      last?.created_at
      || last?.createdAt
      || room?.updated_at
      || room?.updatedAt
      || room?.created_at
      || room?.createdAt
      || 0
    ).getTime() || 0;
  }

  function findFellow(key, fellows = []) {
    const wanted = String(key || "");
    return (Array.isArray(fellows) ? fellows : [])
      .find((item) => String(item?.key || item?.id || "") === wanted) || null;
  }

  function sessionTitle(room, options = {}) {
    if (!room) return options.defaultTitle || "新对话";
    const type = roomType(room, room.id || "");
    if (type === "fellow") {
      if (room.name) return room.name;
      const key = fellowKey(room);
      const fellow = findFellow(key, options.fellows);
      return fellow?.name || key || options.defaultTitle || "新对话";
    }
    if (type === "group") return room.name || options.groupTitle || "群聊";
    if (typeof options.dmTitle === "function") return options.dmTitle(room) || options.dmTitleFallback || "私聊";
    return room.name || options.dmTitle || options.dmTitleFallback || "私聊";
  }

  function sessionRoomsForRoom(room, rooms = [], options = {}) {
    if (!room) return [];
    if (roomType(room, room.id || "") !== "fellow") return [room];
    const key = fellowKey(room);
    if (!key) return [room];
    return (Array.isArray(rooms) ? rooms : [])
      .filter((candidate) => roomType(candidate, candidate?.id || "") === "fellow")
      .filter((candidate) => fellowKey(candidate) === key)
      .sort((a, b) => roomSortTime(b, options.messageCache) - roomSortTime(a, options.messageCache));
  }

  function canCreateSession(room) {
    return roomType(room, room?.id || "") === "fellow" && Boolean(fellowKey(room));
  }

  function createFellowSessionPayload(room, sessionId, options = {}) {
    return {
      fellowKey: fellowKey(room),
      title: options.title || "新对话",
      runtimeKind: runtimeKind(room, options.runtimeKindFallback || "desktop-local"),
      sessionId
    };
  }

  return {
    roomType,
    fellowKey,
    runtimeKind,
    roomSortTime,
    sessionTitle,
    sessionRoomsForRoom,
    canCreateSession,
    createFellowSessionPayload
  };
});
