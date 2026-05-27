const { test } = require("node:test");
const assert = require("node:assert/strict");

const { registerSocialIpc } = require("../src/main/social/social-ipc.js");
const { IpcChannel } = require("../src/shared/ipc-channels.js");

function fakeIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, handler) {
      handlers.set(channel, handler);
    }
  };
}

test("posting a conversation message dispatches the returned user message to main conversation AI", async () => {
  const ipcMain = fakeIpcMain();
  const message = {
    id: "m_1",
    seq: 1,
    sender_kind: "user",
    sender_ref: "u_1",
    body_md: "你好"
  };
  const calls = { dispatched: [] };

  registerSocialIpc({
    ipcMain,
    socialApi: {
      postConversationMessage: async () => ({ message })
    },
    fellowRuntimeDispatcher: {
      handleCloudEvent: async (event) => calls.dispatched.push(event)
    }
  });

  const result = await ipcMain.handlers.get(IpcChannel.SocialPostConversationMessage)(
    null,
    "fellow:u_1:session_1",
    { bodyMd: "你好" }
  );

  assert.deepEqual(result, { ok: true, data: { message } });
  assert.deepEqual(calls.dispatched, [{
    type: "conversation.message_appended",
    conversationId: "fellow:u_1:session_1",
    message
  }]);
});

test("listing conversation messages writes through to the local cache; cached read returns them", async () => {
  const ipcMain = fakeIpcMain();
  const upserts = [];
  const fakeCache = {
    upsertMessages: (conversationId, messages) => upserts.push({ conversationId, messages }),
    getRecentMessages: (conversationId) => (conversationId === "dm:a:b" ? [{ id: "m1", seq: 1 }] : [])
  };
  registerSocialIpc({
    ipcMain,
    socialApi: {
      listConversationMessages: async () => ({ messages: [{ id: "m1", seq: 1 }, { id: "m2", seq: 2 }] })
    },
    messageCache: fakeCache
  });

  const listed = await ipcMain.handlers.get(IpcChannel.SocialListConversationMessages)(null, "dm:a:b", 0, 100);
  assert.equal(listed.ok, true);
  assert.deepEqual(upserts, [{ conversationId: "dm:a:b", messages: [{ id: "m1", seq: 1 }, { id: "m2", seq: 2 }] }]);

  const cached = await ipcMain.handlers.get(IpcChannel.SocialGetCachedMessages)(null, "dm:a:b", 50);
  assert.deepEqual(cached, { ok: true, data: { messages: [{ id: "m1", seq: 1 }] } });
});

test("cached read returns empty envelope when no cache is wired", async () => {
  const ipcMain = fakeIpcMain();
  registerSocialIpc({ ipcMain, socialApi: {} });
  const cached = await ipcMain.handlers.get(IpcChannel.SocialGetCachedMessages)(null, "dm:a:b", 50);
  assert.deepEqual(cached, { ok: true, data: { messages: [] } });
});
