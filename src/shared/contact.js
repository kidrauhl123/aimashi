const ContactKind = Object.freeze({
  Self: "self",
  Fellow: "fellow",
  User: "user"
});

// Single avatar resolver lives in shared/avatar-resolve.js. resolveContact
// hands every kind of contact (self / fellow / user) — found or not, owned
// or not — through the same function so the result is always a usable
// {image, crop, color}. No caller has to invent a "what if there's no
// avatar" branch.
function avatarResolver() {
  if (typeof window !== "undefined" && window.miaAvatarResolve) return window.miaAvatarResolve;
  if (typeof require === "function") {
    try { return require("./avatar-resolve.js"); } catch { /* shared module not loaded */ }
  }
  return null;
}

function avatarForRecord(id, record = {}) {
  const resolver = avatarResolver();
  const input = {
    id: String(id || ""),
    avatarImage: record.avatarImage || "",
    avatarCrop: record.avatarCrop || null,
    color: record.color || record.avatarColor || ""
  };
  if (resolver && typeof resolver.resolveAvatarForContact === "function") {
    return resolver.resolveAvatarForContact(input);
  }
  // Defensive fallback for sandboxes that load contact.js without
  // avatar-resolve.js (e.g. an isolated test). Behaviour matches the old
  // "may be empty" shape rather than silently inventing a different default.
  return { image: input.avatarImage, crop: input.avatarCrop, color: input.color || "#5e5ce6" };
}

function resolveContact(query, ctx = {}) {
  const { kind, ref } = query || {};
  if (kind === ContactKind.Self) {
    const u = ctx.self || {};
    return {
      kind: ContactKind.Self,
      id: u.id || "",
      displayName: u.displayName || u.username || u.account || u.avatarText || "",
      avatar: avatarForRecord(u.id, u)
    };
  }
  if (kind === ContactKind.Fellow) {
    const fellows = Array.isArray(ctx.fellows) ? ctx.fellows : [];
    const f = fellows.find((x) => x.key === ref || x.id === ref);
    const id = String((f && (f.key || f.id)) || ref || "");
    return {
      kind: ContactKind.Fellow,
      id,
      displayName: (f && (f.name || f.key)) || String(ref || ""),
      avatar: avatarForRecord(id, f || {})
    };
  }
  if (kind === ContactKind.User) {
    if (ctx.self && (ctx.self.id === ref)) return resolveContact({ kind: ContactKind.Self }, ctx);
    const friends = Array.isArray(ctx.friends) ? ctx.friends : [];
    const f = friends.find((x) => x.id === ref);
    const id = String((f && f.id) || ref || "");
    return {
      kind: ContactKind.User,
      id,
      displayName: (f && (f.username || f.account || f.id)) || String(ref || ""),
      avatar: avatarForRecord(id, f || {})
    };
  }
  return {
    kind: "",
    id: "",
    displayName: "",
    avatar: avatarForRecord("", {})
  };
}

const __miaContactExports = { resolveContact, ContactKind, avatarForRecord };
if (typeof module !== "undefined" && module.exports) module.exports = __miaContactExports;
if (typeof window !== "undefined") window.miaContact = __miaContactExports;
