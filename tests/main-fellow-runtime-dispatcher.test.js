const { test } = require("node:test");
const assert = require("node:assert/strict");

const { createMainFellowRuntimeDispatcher } = require("../src/main/social/fellow-runtime-dispatcher.js");

function setup(overrides = {}) {
  const calls = { responder: [], logs: [] };
  const dispatcher = createMainFellowRuntimeDispatcher({
    shouldHandle: () => true,
    listFellows: () => [{ key: "codex", name: "Codex" }],
    localFellowResponder: {
      respond: async (args) => {
        calls.responder.push(args);
        return true;
      }
    },
    log: (line) => calls.logs.push(line),
    ...overrides
  });
  return { dispatcher, calls };
}

test("desktop responds when the cloud requests a fellow invocation", async () => {
  const { dispatcher, calls } = setup();

  await dispatcher.handleCloudEvent({
    type: "conversation.fellow_invocation_requested",
    conversationId: "g_1",
    fellowId: "codex",
    invokedBy: { username: "alice" },
    triggeringMessage: { id: "m_1", body_md: "@codex 看看", sender_kind: "user" },
    recentMessages: [{ sender_kind: "user", sender_ref: "u_1", body_md: "背景" }]
  });

  assert.equal(calls.responder.length, 1);
  assert.equal(calls.responder[0].conversationId, "g_1");
  assert.equal(calls.responder[0].fellowId, "codex");
  assert.equal(calls.responder[0].dedupKey, "m_1:codex");
  assert.match(calls.responder[0].systemPrompt, /背景/);
});

test("conversation.message_appended events do not wake the desktop dispatcher", async () => {
  const { dispatcher, calls } = setup();

  const handled = await dispatcher.handleCloudEvent({
    type: "conversation.message_appended",
    conversationId: "g_1",
    message: { id: "m_2", seq: 2, sender_kind: "user", body_md: "大家看看" }
  });

  assert.equal(handled, false);
  assert.equal(calls.responder.length, 0);
});

test("shouldHandle gate suppresses invocation events", async () => {
  const { dispatcher, calls } = setup({ shouldHandle: () => false });

  const handled = await dispatcher.handleCloudEvent({
    type: "conversation.fellow_invocation_requested",
    conversationId: "g_1",
    fellowId: "codex",
    triggeringMessage: { id: "m_1", body_md: "@codex 看看" }
  });

  assert.equal(handled, false);
  assert.deepEqual(calls.responder, []);
});
