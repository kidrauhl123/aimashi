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
//     self    — { id, displayName, username, avatarImage, avatarCrop, avatarColor }
//     friends — [{ id, displayName, username, avatarImage, avatarCrop, avatarColor }, ...]
//     fellows — [{ id|key, name, avatarImage, avatarCrop, color }, ...]
//
// "What if the contact has no avatarImage" is no longer the caller's
// concern: shared/avatar-resolve.js's resolveAvatarForContact always returns
// a usable {image, crop, color, text}, with no preset-image fallback.
//
// Returns: [{ image, crop, color, text }, ...] in member order.

(function attachGroupTiles(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaGroupTiles = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  function avatarResolver() {
    if (typeof window !== "undefined" && window.miaAvatarResolve) return window.miaAvatarResolve;
    if (typeof require === "function") {
      try { return require("./avatar-resolve.js"); } catch { /* shared module not loaded */ }
    }
    return null;
  }

  function resolveTile(input) {
    const resolver = avatarResolver();
    if (resolver && typeof resolver.resolveAvatarForContact === "function") {
      const result = resolver.resolveAvatarForContact(input);
      return { image: result.image, crop: result.crop, color: result.color, text: result.text };
    }
    return {
      image: input.avatarImage || "",
      crop: input.avatarCrop || null,
      color: input.color || "#5e5ce6",
      text: String(input.displayName || input.id || "?").trim().slice(0, 2) || "?"
    };
  }

  function hasAvatarIdentityFields(record) {
    const resolver = avatarResolver();
    if (resolver && typeof resolver.hasAvatarIdentityFields === "function") {
      return resolver.hasAvatarIdentityFields(record);
    }
    return Boolean(record && typeof record === "object" && (
      Object.prototype.hasOwnProperty.call(record, "avatarImage")
        || Object.prototype.hasOwnProperty.call(record, "avatarCrop")
        || Object.prototype.hasOwnProperty.call(record, "avatar_image")
        || Object.prototype.hasOwnProperty.call(record, "avatar_crop")
    ));
  }

  function resolveGroupMemberTiles(members, ctx = {}) {
    if (!Array.isArray(members)) return [];
    const { self, friends, fellows } = ctx;
    const out = [];
    for (const m of members) {
      if (!m) continue;
      const kind = m.member_kind;
      const ref = String(m.member_ref || "");
      if (kind === "user") {
        const identityAvatar = m.identity?.avatar || {};
        // Self is just another user-kind member; no "boss" position. We
        // still look up self separately because the friend list never
        // includes the viewer. Color is derived from the id by the resolver;
        // no per-contact color field is consulted.
        if (self && ref === self.id) {
          const hasSelfAvatar = hasAvatarIdentityFields(self);
          out.push(resolveTile({
            id: self.id,
            displayName: self.displayName || self.username || self.account || m.identity?.displayName || self.id,
            avatarImage: hasSelfAvatar ? self.avatarImage : identityAvatar.image,
            avatarCrop: hasSelfAvatar ? self.avatarCrop : identityAvatar.crop
          }));
          continue;
        }
        const friend = (friends || []).find((f) => f.id === ref);
        const hasFriend = Boolean(friend);
        const hasFriendAvatar = hasAvatarIdentityFields(friend);
        out.push(resolveTile({
          id: ref,
          displayName: friend?.displayName || friend?.username || friend?.account || m.identity?.displayName || ref,
          avatarImage: hasFriend && hasFriendAvatar ? friend.avatarImage : identityAvatar.image,
          avatarCrop: hasFriend && hasFriendAvatar ? friend.avatarCrop : identityAvatar.crop
        }));
        continue;
      }
      if (kind === "fellow") {
        // Resolution priority: viewer's own fellow registry first (freshest
        // copy of fellows we own), then the server-enriched fields on the
        // member row (cross-owner fellows the server joined into
        // listConversationMembers). resolveAvatarForContact handles the
        // stable text fallback when neither side has an image.
        const fellow = (fellows || []).find((f) => (f.id || f.key) === ref);
        const hasFellow = Boolean(fellow);
        const hasFellowAvatar = hasAvatarIdentityFields(fellow);
        const identityAvatar = m.identity?.avatar || {};
        out.push(resolveTile({
          id: ref,
          displayName: fellow?.name || fellow?.displayName || m.identity?.displayName || m.fellow_name || ref,
          avatarImage: hasFellow && hasFellowAvatar ? fellow.avatarImage : (identityAvatar.image || m.fellow_avatar_image),
          avatarCrop: hasFellow && hasFellowAvatar ? fellow.avatarCrop : (identityAvatar.crop || m.fellow_avatar_crop)
        }));
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
