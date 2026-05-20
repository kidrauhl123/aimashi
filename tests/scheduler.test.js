// tests/scheduler.test.js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { computeNextFire, isFireable } = require("../src/main/scheduler.js");

test("computeNextFire: cron returns parsed next time", () => {
  const now = new Date("2026-05-20T08:00:00Z").getTime();
  const next = computeNextFire(
    { type: "cron", cron: "0 9 * * *" },
    "UTC",
    now
  );
  assert.equal(new Date(next).toISOString(), "2026-05-20T09:00:00.000Z");
});

test("computeNextFire: oneshot returns at time if future", () => {
  const at = "2026-06-01T12:00:00Z";
  const now = new Date("2026-05-20T08:00:00Z").getTime();
  const next = computeNextFire({ type: "oneshot", at }, "UTC", now);
  assert.equal(next, new Date(at).getTime());
});

test("computeNextFire: oneshot returns null if past", () => {
  const at = "2026-04-01T12:00:00Z";
  const now = new Date("2026-05-20T08:00:00Z").getTime();
  assert.equal(computeNextFire({ type: "oneshot", at }, "UTC", now), null);
});

test("computeNextFire: event returns null (v1 unsupported)", () => {
  const now = Date.now();
  assert.equal(computeNextFire({ type: "event" }, "UTC", now), null);
});

test("isFireable: paused tasks not fireable", () => {
  assert.equal(isFireable({ status: "paused" }), false);
  assert.equal(isFireable({ status: "done" }), false);
  assert.equal(isFireable({ status: "failed" }), false);
  assert.equal(isFireable({ status: "active" }), true);
});
