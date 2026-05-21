const crypto = require("node:crypto");

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function createMessagesStore(db) {
  const selectMaxSeq = db.prepare(
    "SELECT COALESCE(MAX(seq), 0) AS max_seq FROM messages WHERE room_id = ?"
  );
  const insertMessage = db.prepare(`
    INSERT INTO messages (
      id, room_id, seq, turn_id, sender_kind, sender_ref, sender_owner_id,
      body_md, attachments_json, mentions_json, status, error_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const selectMessage = db.prepare("SELECT * FROM messages WHERE id = ?");
  const selectSince = db.prepare(`
    SELECT * FROM messages WHERE room_id = ? AND seq > ?
    ORDER BY seq ASC LIMIT ?
  `);
  const updateStatus = db.prepare(
    "UPDATE messages SET status = ?, error_json = COALESCE(?, error_json) WHERE id = ?"
  );

  function appendMessage(args) {
    const {
      roomId,
      senderKind,
      senderRef,
      senderOwnerId = null,
      bodyMd = "",
      attachments = null,
      mentions = null,
      turnId = null,
      status = "complete",
      errorJson = null,
    } = args;
    const id = randomId("m");
    const createdAt = nowIso();
    db.exec("BEGIN");
    try {
      const seq = selectMaxSeq.get(String(roomId)).max_seq + 1;
      insertMessage.run(
        id,
        String(roomId),
        seq,
        turnId,
        String(senderKind),
        String(senderRef),
        senderOwnerId ? String(senderOwnerId) : null,
        String(bodyMd),
        attachments ? JSON.stringify(attachments) : null,
        mentions ? JSON.stringify(mentions) : null,
        String(status),
        errorJson ? JSON.stringify(errorJson) : null,
        createdAt
      );
      db.exec("COMMIT");
    } catch (err) {
      try { db.exec("ROLLBACK"); } catch { /* may already be rolled back */ }
      throw err;
    }
    return selectMessage.get(id);
  }

  function getMessage(id) {
    return selectMessage.get(String(id)) || null;
  }

  function listMessagesSince(roomId, sinceSeq, limit = 100) {
    const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return selectSince.all(String(roomId), Number(sinceSeq) || 0, cap);
  }

  function updateMessageStatus(id, status, errorJson = null) {
    updateStatus.run(String(status), errorJson ? JSON.stringify(errorJson) : null, String(id));
  }

  return { appendMessage, getMessage, listMessagesSince, updateMessageStatus };
}

module.exports = { createMessagesStore };
