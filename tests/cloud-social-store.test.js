const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createCloudStore } = require("../src/cloud/sqlite-store.js");
const { createSocialStore } = require("../src/cloud/social-store.js");

function makeStores() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aimashi-social-test-"));
  const cloudStore = createCloudStore({ dataDir: tmpDir });
  const db = cloudStore.getDb();
  const social = createSocialStore(db);
  const alice = cloudStore.registerUser({ username: "alice", password: "Pa55word!" }).user;
  const bob = cloudStore.registerUser({ username: "bob", password: "Pa55word!" }).user;
  return { cloudStore, social, alice, bob, tmpDir };
}

function cleanup(ctx) {
  ctx.cloudStore.close();
  fs.rmSync(ctx.tmpDir, { recursive: true, force: true });
}

test("addFriendship normalizes order and is idempotent", () => {
  const ctx = makeStores();
  try {
    ctx.social.addFriendship(ctx.alice.id, ctx.bob.id);
    ctx.social.addFriendship(ctx.bob.id, ctx.alice.id);
    const friends = ctx.social.listFriends(ctx.alice.id);
    assert.equal(friends.length, 1);
    assert.equal(friends[0], ctx.bob.id);
  } finally { cleanup(ctx); }
});

test("areFriends returns true after addFriendship, false after remove", () => {
  const ctx = makeStores();
  try {
    assert.equal(ctx.social.areFriends(ctx.alice.id, ctx.bob.id), false);
    ctx.social.addFriendship(ctx.alice.id, ctx.bob.id);
    assert.equal(ctx.social.areFriends(ctx.alice.id, ctx.bob.id), true);
    assert.equal(ctx.social.areFriends(ctx.bob.id, ctx.alice.id), true);
    ctx.social.removeFriendship(ctx.alice.id, ctx.bob.id);
    assert.equal(ctx.social.areFriends(ctx.alice.id, ctx.bob.id), false);
  } finally { cleanup(ctx); }
});

test("createFriendRequest stores pending with code", () => {
  const ctx = makeStores();
  try {
    const req = ctx.social.createFriendRequest({ fromUser: ctx.alice.id, code: "ABC12345" });
    assert.ok(req.id);
    assert.equal(req.status, "pending");
    assert.equal(req.code, "ABC12345");
    const fetched = ctx.social.getFriendRequestByCode("ABC12345");
    assert.equal(fetched.id, req.id);
  } finally { cleanup(ctx); }
});

test("acceptFriendRequest creates friendship and marks accepted atomically", () => {
  const ctx = makeStores();
  try {
    ctx.social.createFriendRequest({ fromUser: ctx.alice.id, code: "CODE1" });
    const resolved = ctx.social.acceptFriendRequest("CODE1", ctx.bob.id);
    assert.equal(resolved.status, "accepted");
    assert.ok(resolved.resolved_at);
    assert.equal(ctx.social.areFriends(ctx.alice.id, ctx.bob.id), true);
  } finally { cleanup(ctx); }
});

test("acceptFriendRequest rejects already-consumed code", () => {
  const ctx = makeStores();
  try {
    ctx.social.createFriendRequest({ fromUser: ctx.alice.id, code: "ONCE" });
    ctx.social.acceptFriendRequest("ONCE", ctx.bob.id);
    const charlie = ctx.cloudStore.registerUser({ username: "charlie", password: "Pa55word!" }).user;
    assert.throws(() => ctx.social.acceptFriendRequest("ONCE", charlie.id), /not pending|already/i);
  } finally { cleanup(ctx); }
});

test("acceptFriendRequest rejects self-accept", () => {
  const ctx = makeStores();
  try {
    ctx.social.createFriendRequest({ fromUser: ctx.alice.id, code: "SELF" });
    assert.throws(() => ctx.social.acceptFriendRequest("SELF", ctx.alice.id), /self/i);
  } finally { cleanup(ctx); }
});

test("revokeFriendRequest marks expired only by owner", () => {
  const ctx = makeStores();
  try {
    ctx.social.createFriendRequest({ fromUser: ctx.alice.id, code: "REV" });
    assert.throws(() => ctx.social.revokeFriendRequest("REV", ctx.bob.id), /not owner|forbidden/i);
    ctx.social.revokeFriendRequest("REV", ctx.alice.id);
    const row = ctx.social.getFriendRequestByCode("REV");
    assert.equal(row.status, "expired");
  } finally { cleanup(ctx); }
});

test("expireOldRequests transitions pending older than maxAgeMs to expired", async () => {
  const ctx = makeStores();
  try {
    ctx.social.createFriendRequest({ fromUser: ctx.alice.id, code: "OLD" });
    await new Promise((r) => setTimeout(r, 50));
    const n = ctx.social.expireOldRequests(25);
    assert.ok(n >= 1);
    const row = ctx.social.getFriendRequestByCode("OLD");
    assert.equal(row.status, "expired");
  } finally { cleanup(ctx); }
});
