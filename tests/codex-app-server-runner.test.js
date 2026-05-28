const { test } = require("node:test");
const assert = require("node:assert/strict");
const { codexDecisionFor, toolPayloadFromCodexItem } = require("../src/main/codex-app-server-runner.js");

test("codexDecisionFor maps Mia decisions to app-server approval responses", () => {
  assert.deepEqual(codexDecisionFor("item/commandExecution/requestApproval", { decision: "allow", scope: "once" }), {
    decision: "accept"
  });
  assert.deepEqual(codexDecisionFor("item/commandExecution/requestApproval", { decision: "allow", scope: "always" }), {
    decision: "acceptForSession"
  });
  assert.deepEqual(codexDecisionFor("item/fileChange/requestApproval", { decision: "deny" }), {
    decision: "decline"
  });
  assert.deepEqual(codexDecisionFor("execCommandApproval", { decision: "allow", scope: "always" }), {
    decision: "approved_for_session"
  });
});

test("toolPayloadFromCodexItem normalizes command and file-change items", () => {
  assert.deepEqual(toolPayloadFromCodexItem({
    type: "commandExecution",
    id: "cmd_1",
    command: "npm test",
    status: "completed",
    durationMs: 1250
  }), {
    id: "cmd_1",
    name: "shell",
    preview: "npm test",
    status: "completed",
    duration: 1.25,
    error: false
  });
  assert.deepEqual(toolPayloadFromCodexItem({
    type: "fileChange",
    id: "patch_1",
    changes: [{ kind: "update", path: "src/app.js" }],
    status: "completed"
  }), {
    id: "patch_1",
    name: "apply_patch",
    preview: "update src/app.js",
    status: "completed",
    duration: null,
    error: false
  });
});
