const crypto = require("node:crypto");

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function orderPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

function createSocialStore(db) {
  const insertFriendship = db.prepare(
    "INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)"
  );
  const deleteFriendship = db.prepare(
    "DELETE FROM friendships WHERE user_a = ? AND user_b = ?"
  );
  const selectFriendship = db.prepare(
    "SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?"
  );
  const selectFriendsOf = db.prepare(
    "SELECT user_a, user_b FROM friendships WHERE user_a = ? OR user_b = ?"
  );

  const insertRequest = db.prepare(`
    INSERT INTO friend_requests (id, from_user, to_user, code, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);
  const selectRequestByCode = db.prepare(
    "SELECT * FROM friend_requests WHERE code = ?"
  );
  const updateRequestStatus = db.prepare(
    "UPDATE friend_requests SET status = ?, resolved_at = ? WHERE id = ?"
  );
  const selectIncomingPending = db.prepare(`
    SELECT * FROM friend_requests
    WHERE to_user = ? AND status = 'pending'
    ORDER BY created_at DESC
  `);
  const expirePendingOlderThan = db.prepare(
    "UPDATE friend_requests SET status = 'expired' WHERE status = 'pending' AND created_at < ?"
  );

  function addFriendship(userA, userB) {
    if (userA === userB) throw new Error("cannot befriend self");
    const [a, b] = orderPair(String(userA), String(userB));
    insertFriendship.run(a, b, nowIso());
  }

  function removeFriendship(userA, userB) {
    const [a, b] = orderPair(String(userA), String(userB));
    deleteFriendship.run(a, b);
  }

  function areFriends(userA, userB) {
    const [a, b] = orderPair(String(userA), String(userB));
    return Boolean(selectFriendship.get(a, b));
  }

  function listFriends(userId) {
    const id = String(userId);
    return selectFriendsOf.all(id, id).map((row) => (row.user_a === id ? row.user_b : row.user_a));
  }

  function createFriendRequest({ fromUser, toUser = null, code }) {
    const id = randomId("fr");
    const createdAt = nowIso();
    insertRequest.run(id, String(fromUser), toUser ? String(toUser) : null, String(code), createdAt);
    return { id, from_user: String(fromUser), to_user: toUser ? String(toUser) : null, code: String(code), status: "pending", created_at: createdAt, resolved_at: null };
  }

  function getFriendRequestByCode(code) {
    return selectRequestByCode.get(String(code)) || null;
  }

  function acceptFriendRequest(code, accepterUserId) {
    const row = selectRequestByCode.get(String(code));
    if (!row) throw new Error("friend request not found");
    if (row.status !== "pending") throw new Error("friend request not pending");
    if (row.from_user === String(accepterUserId)) throw new Error("cannot accept self friend request");
    const resolvedAt = nowIso();
    db.exec("BEGIN");
    try {
      updateRequestStatus.run("accepted", resolvedAt, row.id);
      const [a, b] = orderPair(row.from_user, String(accepterUserId));
      insertFriendship.run(a, b, resolvedAt);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return { ...row, status: "accepted", resolved_at: resolvedAt };
  }

  function revokeFriendRequest(code, ownerUserId) {
    const row = selectRequestByCode.get(String(code));
    if (!row) throw new Error("friend request not found");
    if (row.from_user !== String(ownerUserId)) throw new Error("not owner of friend request");
    if (row.status !== "pending") return row;
    const resolvedAt = nowIso();
    updateRequestStatus.run("expired", resolvedAt, row.id);
    return { ...row, status: "expired", resolved_at: resolvedAt };
  }

  function listIncomingPending(userId) {
    return selectIncomingPending.all(String(userId));
  }

  function expireOldRequests(maxAgeMs) {
    const cutoff = new Date(Date.now() - Number(maxAgeMs)).toISOString();
    const info = expirePendingOlderThan.run(cutoff);
    return info.changes;
  }

  return {
    addFriendship,
    removeFriendship,
    areFriends,
    listFriends,
    createFriendRequest,
    getFriendRequestByCode,
    acceptFriendRequest,
    revokeFriendRequest,
    listIncomingPending,
    expireOldRequests,
  };
}

module.exports = { createSocialStore };
