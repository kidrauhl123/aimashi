// Per-user cross-device settings (Phase 3). Holds:
//   pins:        ["room_id_a", "fellow_key_b", ...]   — pinned conversation refs
//   readMarks:   { "room_id_a": last_seen_seq, ... } — last seq the user has read
//   appearance:  { theme, listStyle, ... }            — UI preferences
//
// One row per user, JSON-bagged so we don't migrate the schema for every
// new setting category. Server is canonical. Clients hold a cached copy
// and write back via PUT /api/me/settings; a user_settings.updated event
// broadcasts the new shape to every connected device.

function nowIso() {
  return new Date().toISOString();
}

function parseJsonOr(value, fallback) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed == null ? fallback : parsed;
  } catch { return fallback; }
}

function defaultSettings() {
  return { pins: [], readMarks: {}, appearance: {} };
}

function createUserSettingsStore(db) {
  const selectStmt = db.prepare(
    "SELECT pins_json, read_marks_json, appearance_json, updated_at FROM user_settings WHERE user_id = ?"
  );
  const upsertStmt = db.prepare(
    "INSERT INTO user_settings (user_id, pins_json, read_marks_json, appearance_json, updated_at) " +
    "VALUES (?, ?, ?, ?, ?) " +
    "ON CONFLICT (user_id) DO UPDATE SET " +
    "  pins_json = excluded.pins_json, read_marks_json = excluded.read_marks_json, " +
    "  appearance_json = excluded.appearance_json, updated_at = excluded.updated_at " +
    "RETURNING pins_json, read_marks_json, appearance_json, updated_at"
  );

  function getSettings(userId) {
    const row = selectStmt.get(String(userId));
    if (!row) return { ...defaultSettings(), updatedAt: "" };
    return {
      pins: parseJsonOr(row.pins_json, []),
      readMarks: parseJsonOr(row.read_marks_json, {}),
      appearance: parseJsonOr(row.appearance_json, {}),
      updatedAt: row.updated_at
    };
  }

  // Whole-bag replace. Caller is responsible for merging existing+incoming
  // before calling — this keeps the store dumb and lets the HTTP layer
  // decide policy (e.g., partial PATCH vs full PUT semantics).
  function putSettings(userId, { pins, readMarks, appearance }) {
    const safe = {
      pins: Array.isArray(pins) ? pins.map(String).slice(0, 1000) : [],
      readMarks: readMarks && typeof readMarks === "object" ? readMarks : {},
      appearance: appearance && typeof appearance === "object" ? appearance : {}
    };
    const row = upsertStmt.get(
      String(userId),
      JSON.stringify(safe.pins),
      JSON.stringify(safe.readMarks),
      JSON.stringify(safe.appearance),
      nowIso()
    );
    return {
      pins: parseJsonOr(row.pins_json, []),
      readMarks: parseJsonOr(row.read_marks_json, {}),
      appearance: parseJsonOr(row.appearance_json, {}),
      updatedAt: row.updated_at
    };
  }

  return { getSettings, putSettings, defaultSettings };
}

module.exports = { createUserSettingsStore };
