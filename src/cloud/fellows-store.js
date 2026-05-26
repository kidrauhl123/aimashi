// Per-user fellow definitions on cloud (Phase 2 of the sync architecture
// redesign — see docs/superpowers/plans/2026-05-23-sync-architecture-redesign
// .md §3.3.5).
//
// We store ONLY the identity-shape of a fellow: name, avatar, persona,
// capabilities. Runtime config (which engine binary, which model, which
// agent config) is desktop-local because it's tied to the physical
// host. The cloud copy is what web/mobile/other-desktop devices read so
// they can render fellow chats coherently — "this message is from
// Codex" rather than "unknown".

function nowIso() {
  return new Date().toISOString();
}

function parseJsonOr(value, fallback) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed == null ? fallback : parsed;
  } catch { return fallback; }
}

function serializableCapabilities(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  return [];
}

function rowToFellow(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    color: row.color || "",
    avatarImage: row.avatar_image || "",
    avatarCrop: parseJsonOr(row.avatar_crop_json, null),
    bio: row.bio || "",
    capabilities: parseJsonOr(row.capabilities_json, []),
    personaText: row.persona_text || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createFellowsStore(db) {
  const upsertStmt = db.prepare(
    "INSERT INTO fellows (id, owner_user_id, name, color, avatar_image, avatar_crop_json, bio, capabilities_json, persona_text, created_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT (owner_user_id, id) DO UPDATE SET " +
    "  name = excluded.name, color = excluded.color, avatar_image = excluded.avatar_image, " +
    "  avatar_crop_json = excluded.avatar_crop_json, bio = excluded.bio, " +
    "  capabilities_json = excluded.capabilities_json, persona_text = excluded.persona_text, " +
    "  updated_at = excluded.updated_at " +
    "RETURNING id, owner_user_id, name, color, avatar_image, avatar_crop_json, bio, capabilities_json, persona_text, created_at, updated_at"
  );
  const selectStmt = db.prepare(
    "SELECT id, owner_user_id, name, color, avatar_image, avatar_crop_json, bio, capabilities_json, persona_text, created_at, updated_at " +
    "FROM fellows WHERE owner_user_id = ? AND id = ?"
  );
  const listStmt = db.prepare(
    "SELECT id, owner_user_id, name, color, avatar_image, avatar_crop_json, bio, capabilities_json, persona_text, created_at, updated_at " +
    "FROM fellows WHERE owner_user_id = ? ORDER BY updated_at DESC"
  );
  const deleteStmt = db.prepare("DELETE FROM fellows WHERE owner_user_id = ? AND id = ?");

  function upsertFellow(ownerUserId, fellow) {
    if (!ownerUserId) throw new Error("upsertFellow: ownerUserId required");
    if (!fellow || !fellow.id || !fellow.name) throw new Error("upsertFellow: fellow.id and fellow.name required");
    const now = nowIso();
    const existing = selectStmt.get(String(ownerUserId), String(fellow.id));
    const createdAt = existing ? existing.created_at : now;
    const row = upsertStmt.get(
      String(fellow.id),
      String(ownerUserId),
      String(fellow.name),
      String(fellow.color || ""),
      String(fellow.avatarImage || ""),
      fellow.avatarCrop ? JSON.stringify(fellow.avatarCrop) : "",
      String(fellow.bio || ""),
      JSON.stringify(serializableCapabilities(fellow.capabilities)),
      String(fellow.personaText || ""),
      createdAt,
      now
    );
    return rowToFellow(row);
  }

  function getFellow(ownerUserId, fellowId) {
    return rowToFellow(selectStmt.get(String(ownerUserId), String(fellowId)));
  }

  function listFellows(ownerUserId) {
    return listStmt.all(String(ownerUserId)).map(rowToFellow);
  }

  function deleteFellow(ownerUserId, fellowId) {
    return deleteStmt.run(String(ownerUserId), String(fellowId)).changes;
  }

  return { upsertFellow, getFellow, listFellows, deleteFellow };
}

module.exports = { createFellowsStore };
