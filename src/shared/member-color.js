(function attachMemberColor(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaMemberColor = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function buildMemberColor() {
  const PALETTE = Object.freeze([
    "#e17076",
    "#f0a574",
    "#b08fd8",
    "#7bc862",
    "#65aadd",
    "#ee7aae",
    "#6ec9cb"
  ]);

  function hashCode(value) {
    const str = String(value || "");
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  // Pick a stable palette color for any conversation participant — user or
  // fellow, no distinction. Same id always lands on the same color so the
  // member's bubble title, avatar fallback, and any other chip stay in sync
  // without anything having to remember a per-member color preference.
  function memberAccentColor(id) {
    const key = String(id || "").trim();
    if (!key) return PALETTE[0];
    return PALETTE[hashCode(key) % PALETTE.length];
  }

  return { PALETTE, memberAccentColor };
});
