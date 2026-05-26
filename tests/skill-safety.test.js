const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { isSafeId, isSafeVersion, slugify, isSafeEntryName, assertInside } = require("../src/shared/skill-safety.js");

test("isSafeId accepts namespaced ids, rejects traversal/separators", () => {
  assert.ok(isSafeId("commit-craft"));
  assert.ok(isSafeId("alice.my-helper"));
  assert.ok(!isSafeId("../escape"));
  assert.ok(!isSafeId("a/b"));
  assert.ok(!isSafeId("a\\b"));
  assert.ok(!isSafeId(".."));
  assert.ok(!isSafeId(""));
});

test("isSafeVersion accepts semver-ish, rejects traversal", () => {
  assert.ok(isSafeVersion("1.0.0"));
  assert.ok(isSafeVersion("2.1.0-beta+3"));
  assert.ok(!isSafeVersion("../1"));
  assert.ok(!isSafeVersion("1/0"));
});

test("isSafeEntryName rejects absolute/traversal/drive/NUL", () => {
  assert.ok(isSafeEntryName("SKILL.md"));
  assert.ok(isSafeEntryName("scripts/run.py"));
  assert.ok(!isSafeEntryName("../../evil.txt"));
  assert.ok(!isSafeEntryName("/etc/passwd"));
  assert.ok(!isSafeEntryName("C:\\evil"));
  assert.ok(!isSafeEntryName("a\\..\\b"));
  assert.ok(!isSafeEntryName("a\0b"));
});

test("assertInside throws when the resolved path escapes the parent", () => {
  const parent = path.resolve("/tmp/mia-skills/abc");
  assert.equal(assertInside(parent, path.join(parent, "scripts/x.py")), path.join(parent, "scripts/x.py"));
  assert.throws(() => assertInside(parent, path.join(parent, "../../../etc/passwd")), /escapes/);
});

test("slugify strips unsafe chars and traversal", () => {
  assert.equal(slugify("My Helper"), "my-helper");
  assert.equal(slugify("../../x"), "x");
  assert.equal(slugify("a/b\\c"), "a-b-c");
});
