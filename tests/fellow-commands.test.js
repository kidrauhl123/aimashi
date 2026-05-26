const { test } = require("node:test");
const assert = require("node:assert/strict");

const commands = require("../src/renderer/fellow/fellow-commands.js");

test("saveFellow creates a cloud-hermes fellow through identity, runtime, and room commands", async () => {
  const calls = [];
  const state = {
    runtime: {
      cloud: { enabled: true },
      fellows: [{ key: "local", name: "Local" }]
    }
  };
  const social = {
    moduleState: {
      fellows: [{ id: "mia", name: "Mia" }]
    },
    upsertFellowRoom(room) {
      calls.push(["upsertRoom", room.id]);
      return room;
    }
  };
  const api = {
    social: {
      async saveFellowIdentity(key, body) {
        calls.push(["identity", key, body]);
        return { ok: true, data: { fellow: { id: key, ...body } } };
      },
      async saveFellowRuntime(key, body) {
        calls.push(["runtime", key, body]);
        return { ok: true, data: { binding: { fellowId: key, ...body } } };
      },
      async ensureFellowRoom(key, body) {
        calls.push(["room", key, body]);
        return { ok: true, data: { room: { id: `fellow:u_1:${key}`, type: "fellow", decorations: { fellowKey: key, runtimeKind: body.runtimeKind } } } };
      }
    }
  };

  const result = await commands.saveFellow({
    state,
    api,
    social,
    runtimeKind: "cloud-hermes",
    isCreate: true,
    cloudModelEntries: () => [{ id: "mia-fast", label: "Mia Fast" }],
    fellow: {
      name: "Alice",
      avatarImage: "alice.png",
      avatarCrop: { x: 50, y: 50, zoom: 1 },
      personaText: "Helpful"
    }
  });

  assert.equal(result.key, "alice");
  assert.equal(result.room.id, "fellow:u_1:alice");
  assert.deepEqual(calls.map((call) => call[0]), ["identity", "runtime", "room", "upsertRoom"]);
  assert.equal(calls[1][2].config.model, "mia-fast");
  assert.equal(calls[2][2].runtimeKind, "cloud-hermes");
  assert.equal(social.moduleState.fellows[0].id, "alice");
});

test("saveFellow saves a desktop-local fellow through the local runtime command", async () => {
  const calls = [];
  const runtime = {
    fellows: [
      { key: "alice", name: "Alice" },
      { key: "mia", name: "Mia" }
    ]
  };
  const api = {
    async saveFellow(fellow) {
      calls.push(["local", fellow]);
      return runtime;
    }
  };

  const result = await commands.saveFellow({
    state: { runtime: { cloud: { enabled: true } } },
    api,
    social: {},
    runtimeKind: "desktop-local",
    isCreate: true,
    loadChatSessions: async () => calls.push(["sessions"]),
    fellow: { name: "Alice", agentEngine: "codex" }
  });

  assert.equal(result.key, "alice");
  assert.equal(result.runtime, runtime);
  assert.deepEqual(calls.map((call) => call[0]), ["local", "sessions"]);
  assert.equal(calls[0][1].agentEngine, "codex");
});

test("deleteFellow removes a cloud-hermes fellow through cloud identity commands", async () => {
  const calls = [];
  const social = {
    moduleState: {
      fellows: [
        { id: "alice", name: "Alice" },
        { id: "mia", name: "Mia" }
      ]
    },
    async bootstrapAfterLogin() {
      calls.push(["bootstrap"]);
    }
  };
  const api = {
    social: {
      async deleteFellow(fellowId) {
        calls.push(["cloudDelete", fellowId]);
        return { ok: true };
      }
    }
  };

  const result = await commands.deleteFellow({
    state: { runtime: { cloud: { enabled: true } } },
    api,
    social,
    fellow: { key: "alice", runtimeKind: "cloud-hermes" }
  });

  assert.equal(result.deleted, true);
  assert.deepEqual(calls, [["cloudDelete", "alice"], ["bootstrap"]]);
  assert.deepEqual(social.moduleState.fellows.map((item) => item.id), ["mia"]);
});

test("deleteFellow removes a desktop-local fellow through the local runtime command", async () => {
  const calls = [];
  const runtime = { fellows: [{ key: "mia", name: "Mia" }] };
  const api = {
    async deleteFellow(payload) {
      calls.push(["localDelete", payload]);
      return runtime;
    }
  };

  const result = await commands.deleteFellow({
    state: { runtime: {} },
    api,
    social: {},
    loadChatSessions: async () => calls.push(["sessions"]),
    fellow: { key: "alice", runtimeKind: "desktop-local" }
  });

  assert.equal(result.deleted, true);
  assert.equal(result.runtime, runtime);
  assert.deepEqual(calls, [["localDelete", { key: "alice" }], ["sessions"]]);
});
