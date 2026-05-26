const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const directoryPath = path.join(__dirname, "..", "src", "renderer", "fellow", "fellow-directory.js");

test("fellow directory normalizes cloud and device fellows into one product model", () => {
  const { listOwnedFellows } = require(directoryPath);

  const fellows = listOwnedFellows({
    cloudFellows: [
      { id: "mia", name: "Mia", bio: "云端 Agent", color: "#2563eb" }
    ],
    localFellows: [
      { key: "codex", name: "Codex", agentEngine: "codex", deviceName: "Jung MacBook" }
    ],
    runtime: {
      localDevice: { name: "Jung MacBook" },
      cloud: { enabled: true }
    }
  });

  const mia = fellows.find((fellow) => fellow.key === "mia");
  const codex = fellows.find((fellow) => fellow.key === "codex");

  assert.equal(mia.name, "Mia");
  assert.equal(mia.runtimeKind, "cloud-hermes");
  assert.equal(mia.runtimeLabel, "Mia Cloud");
  assert.equal(mia.agentEngine, "hermes");
  assert.equal(mia.canEditIdentity, true);
  assert.equal(mia.canDelete, true);
  assert.equal(mia.cloudOnly, undefined);

  assert.equal(codex.runtimeKind, "desktop-local");
  assert.equal(codex.runtimeLabel, "Jung MacBook");
  assert.equal(codex.agentEngine, "codex");
  assert.equal(codex.canEditIdentity, true);
  assert.equal(codex.canConfigureCapabilities, true);
});

test("fellow directory treats a cloud-mirrored device fellow as one desktop-runtime fellow", () => {
  const { listOwnedFellows } = require(directoryPath);

  const fellows = listOwnedFellows({
    cloudFellows: [
      { id: "alice", name: "Alice Cloud", bio: "cloud copy", color: "#2563eb" }
    ],
    localFellows: [
      { key: "alice", name: "Alice Local", bio: "local copy", agentEngine: "claude-code" }
    ],
    runtime: {
      localDevice: { name: "Office Mac" }
    }
  });

  assert.equal(fellows.length, 1);
  assert.equal(fellows[0].key, "alice");
  assert.equal(fellows[0].name, "Alice Local");
  assert.equal(fellows[0].bio, "local copy");
  assert.equal(fellows[0].runtimeKind, "desktop-local");
  assert.equal(fellows[0].runtimeLabel, "Office Mac");
  assert.deepEqual(fellows[0].sourceKinds, ["cloud", "desktop"]);
});

test("fellow directory attaches as a browser global", () => {
  const source = fs.readFileSync(directoryPath, "utf8");
  const window = {};
  const context = vm.createContext({ window, globalThis: window });
  vm.runInContext(source, context, { filename: directoryPath });

  assert.equal(typeof window.miaFellowDirectory.listOwnedFellows, "function");
  assert.equal(window.miaFellowDirectory.runtimeLabelFor({ runtimeKind: "cloud-hermes" }), "Mia Cloud");
});
