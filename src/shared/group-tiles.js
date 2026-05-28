// Shared "members → avatar tiles" resolver. ONE source of truth for every
// place in the app (desktop sidebar, desktop chat header, web sidebar) that
// paints a group's stacked-tile avatar.
//
// The premise the user kept reminding us of: a group's avatar is just its
// members' avatars stacked. There is no "boss" position, no separate
// per-conversation icon, no per-renderer fallback table. One function takes
// the members list + a context with profile lookups, returns the tiles.
//
// Inputs:
//   members: [{ member_kind: "user" | "fellow", member_ref: string }, ...]
//            (Server-canonical shape from /api/conversations/:id. Local groups
//            are converted via localGroupAsMembers() first so the
//            resolver itself only sees one shape.)
//   ctx:
//     self    — { id, avatarImage, avatarCrop, avatarColor }
//     friends — [{ id, avatarImage, avatarCrop, avatarColor }, ...]
//     fellows — [{ id|key, avatarImage, avatarCrop, color }, ...]
//     avatarAssetForKey(fellowId) — optional fallback for unknown fellows
//
// Returns: [{ image, crop, color }, ...] in member order, with nulls filtered.

(function attachGroupTiles(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaGroupTiles = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function resolveGroupMemberTiles(members, ctx = {}) {
    if (!Array.isArray(members)) return [];
    const { self, friends, fellows, avatarAssetForKey } = ctx;
    const out = [];
    for (const m of members) {
      if (!m) continue;
      const kind = m.member_kind;
      const ref = m.member_ref;
      if (kind === "user") {
        // Self is just another user-kind member; no special "boss" position
        // or default color. We still look up self separately because the
        // friend list never includes the viewer.
        if (self && ref === self.id) {
          out.push({
            image: self.avatarImage || "",
            crop: self.avatarCrop || null,
            color: self.avatarColor || "#5e5ce6"
          });
          continue;
        }
        const friend = (friends || []).find((f) => f.id === ref);
        if (friend) {
          out.push({
            image: friend.avatarImage || "",
            crop: friend.avatarCrop || null,
            color: friend.avatarColor || "#5e5ce6"
          });
          continue;
        }
        out.push({ image: "", crop: null, color: "#5e5ce6" });
        continue;
      }
      if (kind === "fellow") {
        // Resolution priority mirrors cloud-conversation-source.js for
        // message authors: own fellow registry first (we hold the freshest
        // copy of fellows we own), then the server-enriched fields on the
        // member row (covers cross-owner fellows uniformly — the server
        // joins fellow definitions into listConversationMembers), then
        // the asset fallback. Without the member-row branch, group tiles
        // showed blank squares for any fellow the viewer didn't own.
        const fellow = (fellows || []).find((f) => (f.id || f.key) === ref);
        out.push({
          image: fellow?.avatarImage
            || m.fellow_avatar_image
            || (typeof avatarAssetForKey === "function" ? avatarAssetForKey(ref) : ""),
          crop: fellow?.avatarCrop || m.fellow_avatar_crop || null,
          color: fellow?.color || m.fellow_color || "#5e5ce6"
        });
        continue;
      }
      // Unknown kind: skip (tile stays out of the mosaic).
    }
    return out;
  }

  // Local-store groups only persist fellow members; the user-self is
  // implicit (every local group has the local user as its owner). Convert
  // that shorthand to the same shape the cloud uses so resolveGroupMemberTiles
  // can treat both worlds identically.
  function localGroupAsMembers(group, selfId) {
    const members = [];
    if (selfId) members.push({ member_kind: "user", member_ref: selfId });
    for (const m of (group?.members || [])) {
      if (m && m.fellowId) members.push({ member_kind: "fellow", member_ref: m.fellowId });
    }
    return members;
  }

  return { resolveGroupMemberTiles, localGroupAsMembers };
});
