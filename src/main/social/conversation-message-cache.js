// Desktop-local cache of cloud conversation messages, backed by node:sqlite.
//
// The cloud remains the source of truth; this is a render cache so that opening
// a conversation paints instantly from disk (TG-style local-first render) and a
// reconnect only fetches messages newer than what we already have
// (delta sync keyed on the monotonic per-conversation `seq`).
//
// Each row stores the full message JSON in `payload` so new message fields ride
// along without a schema migration; the extracted columns exist only for
// querying/ordering. Client-only transient fields (e.g. in-place `translation`)
// are intentionally NOT persisted.

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_RECENT_LIMIT = 50;
const DEFAULT_PRUNE_KEEP = 300;

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      conversation_id TEXT NOT NULL,
      id              TEXT NOT NULL,
      seq             INTEGER NOT NULL,
      sender_kind     TEXT,
      sender_ref      TEXT,
      body_md         TEXT,
      created_at      TEXT,
      payload         TEXT NOT NULL,
      PRIMARY KEY (conversation_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_seq
      ON messages (conversation_id, seq);
  `);
}

// dbPath: absolute path to the sqlite file. The directory is created if missing.
function openConversationMessageCache(dbPath) {
  if (!dbPath || typeof dbPath !== "string") {
    throw new Error("[conversation-message-cache] dbPath is required");
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  migrate(db);

  const insertStmt = db.prepare(`
    INSERT INTO messages (conversation_id, id, seq, sender_kind, sender_ref, body_md, created_at, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (conversation_id, id) DO UPDATE SET
      seq = excluded.seq,
      sender_kind = excluded.sender_kind,
      sender_ref = excluded.sender_ref,
      body_md = excluded.body_md,
      created_at = excluded.created_at,
      payload = excluded.payload
  `);
  const recentStmt = db.prepare(`
    SELECT payload FROM messages
    WHERE conversation_id = ?
    ORDER BY seq DESC
    LIMIT ?
  `);
  const maxSeqStmt = db.prepare(`
    SELECT MAX(seq) AS maxSeq FROM messages WHERE conversation_id = ?
  `);
  const deleteConvStmt = db.prepare("DELETE FROM messages WHERE conversation_id = ?");
  const pruneStmt = db.prepare(`
    DELETE FROM messages
    WHERE conversation_id = ?
      AND seq <= (
        SELECT seq FROM messages
        WHERE conversation_id = ?
        ORDER BY seq DESC
        LIMIT 1 OFFSET ?
      )
  `);

  // Persist a batch of messages for a conversation. Missing/invalid seq is
  // skipped — a message without a server seq has no stable cache identity.
  function upsertMessages(conversationId, messages) {
    const convId = String(conversationId || "");
    if (!convId || !Array.isArray(messages) || messages.length === 0) return 0;
    let written = 0;
    db.exec("BEGIN");
    try {
      for (const msg of messages) {
        if (!msg || typeof msg !== "object") continue;
        const seq = Number(msg.seq);
        const id = String(msg.id || "");
        if (!id || !Number.isFinite(seq)) continue;
        const { translation, ...persisted } = msg; // drop client-only transient state
        insertStmt.run(
          convId,
          id,
          seq,
          msg.sender_kind != null ? String(msg.sender_kind) : null,
          msg.sender_ref != null ? String(msg.sender_ref) : null,
          msg.body_md != null ? String(msg.body_md) : null,
          msg.created_at != null ? String(msg.created_at) : null,
          JSON.stringify(persisted)
        );
        written += 1;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    return written;
  }

  // Newest `limit` messages, returned oldest→newest (render order).
  function getRecentMessages(conversationId, limit = DEFAULT_RECENT_LIMIT) {
    const convId = String(conversationId || "");
    if (!convId) return [];
    const cap = Math.max(1, Math.min(Number(limit) || DEFAULT_RECENT_LIMIT, 1000));
    const rows = recentStmt.all(convId, cap);
    const out = [];
    for (const row of rows) {
      try {
        out.push(JSON.parse(row.payload));
      } catch { /* skip a corrupt row rather than fail the whole load */ }
    }
    return out.reverse();
  }

  function getMaxSeq(conversationId) {
    const convId = String(conversationId || "");
    if (!convId) return 0;
    const row = maxSeqStmt.get(convId);
    return Number(row?.maxSeq) || 0;
  }

  function deleteConversation(conversationId) {
    const convId = String(conversationId || "");
    if (!convId) return;
    deleteConvStmt.run(convId);
  }

  // Keep only the newest `keep` messages for a conversation, dropping older rows.
  function pruneConversation(conversationId, keep = DEFAULT_PRUNE_KEEP) {
    const convId = String(conversationId || "");
    if (!convId) return;
    const keepN = Math.max(1, Number(keep) || DEFAULT_PRUNE_KEEP);
    pruneStmt.run(convId, convId, keepN);
  }

  function close() {
    db.close();
  }

  return {
    upsertMessages,
    getRecentMessages,
    getMaxSeq,
    deleteConversation,
    pruneConversation,
    close
  };
}

module.exports = { openConversationMessageCache, DEFAULT_RECENT_LIMIT };
