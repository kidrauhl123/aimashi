// Path / package safety for the open skill marketplace. Untrusted users
// publish zips that get written to disk on the server and extracted on
// desktops, so ids/versions/entry-names that flow into filesystem paths
// must be strictly validated (no traversal, no absolute paths, no zip-slip).

const path = require("node:path");

const MAX_FILES = 500;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const MAX_ENTRY_NAME = 255;

// id like "commit-craft" or "alice.my-helper": alnum start, then [A-Za-z0-9._-],
// never containing "..".
function isSafeId(id) {
  const s = String(id || "");
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(s) && !s.includes("..");
}

function isSafeVersion(v) {
  const s = String(v || "");
  return /^[0-9][0-9A-Za-z.+-]{0,30}$/.test(s) && !s.includes("..");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60) || "skill";
}

// A zip entry name is safe to extract: relative, no "..", no backslash/drive,
// no NUL, bounded length.
function isSafeEntryName(name) {
  const s = String(name || "");
  if (!s || s.includes("\0")) return false;
  if (s.startsWith("/") || s.startsWith("\\")) return false;
  if (/^[A-Za-z]:/.test(s)) return false;
  if (s.length > MAX_ENTRY_NAME) return false;
  return !s.split(/[\\/]/).some((segment) => segment === "..");
}

// Resolve childPath and assert it stays inside parentDir; throws otherwise.
function assertInside(parentDir, childPath) {
  const parent = path.resolve(parentDir);
  const child = path.resolve(childPath);
  if (child !== parent && !child.startsWith(parent + path.sep)) {
    throw new Error("path escapes its parent directory");
  }
  return child;
}

module.exports = {
  MAX_FILES,
  MAX_UNCOMPRESSED_BYTES,
  MAX_ENTRY_NAME,
  isSafeId,
  isSafeVersion,
  slugify,
  isSafeEntryName,
  assertInside
};
