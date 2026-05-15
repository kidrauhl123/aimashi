const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseMentions,
  filterRecentTurnsForFellow,
} = require("../src/renderer/group-prompts.js");

const fellows = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
  { id: "coder", name: "Coder" },
];

test("parseMentions extracts @name and resolves to fellow ids", () => {
  assert.deepEqual(parseMentions("hey @alice 看下", fellows), ["alice"]);
  assert.deepEqual(parseMentions("@alice @bob 一起", fellows), ["alice", "bob"]);
  assert.deepEqual(parseMentions("没人", fellows), []);
});

test("parseMentions ignores unknown @names", () => {
  assert.deepEqual(parseMentions("@nobody 在吗", fellows), []);
});

test("parseMentions dedupes", () => {
  assert.deepEqual(parseMentions("@alice @alice 重复", fellows), ["alice"]);
});

test("parseMentions skips escaped \\@name", () => {
  assert.deepEqual(parseMentions("看下 \\@alice 转义", fellows), []);
});

test("filterRecentTurnsForFellow returns last K turns mentioning the fellow", () => {
  const messages = [
    { id: "m1", role: "user", turnId: "t1", mentions: ["alice"], content: "@alice" },
    { id: "m2", role: "fellow", senderFellowId: "alice", turnId: "t1", content: "hi" },
    { id: "m3", role: "user", turnId: "t2", mentions: ["bob"], content: "@bob" },
    { id: "m4", role: "fellow", senderFellowId: "bob", turnId: "t2", content: "yo" },
    { id: "m5", role: "user", turnId: "t3", mentions: ["alice"], content: "@alice 2" },
    { id: "m6", role: "fellow", senderFellowId: "alice", turnId: "t3", content: "hi 2" },
  ];
  const filtered = filterRecentTurnsForFellow(messages, "alice", 3);
  assert.equal(filtered.length, 4);
  assert.deepEqual(filtered.map((m) => m.id), ["m1", "m2", "m5", "m6"]);
});

test("filterRecentTurnsForFellow caps at K most recent matching turns", () => {
  const messages = Array.from({ length: 10 }, (_, i) => ({
    id: "m" + i,
    role: i % 2 === 0 ? "user" : "fellow",
    turnId: "t" + Math.floor(i / 2),
    senderFellowId: i % 2 === 0 ? null : "alice",
    mentions: i % 2 === 0 ? ["alice"] : [],
    content: "msg " + i,
  }));
  const filtered = filterRecentTurnsForFellow(messages, "alice", 2);
  const turnIds = [...new Set(filtered.map((m) => m.turnId))];
  assert.deepEqual(turnIds, ["t3", "t4"]);
});
