const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");

test("project structure check covers cloud release helpers and rejects root source duplicates", () => {
  const source = fs.readFileSync(path.join(root, "src/check.js"), "utf8");
  assert.match(source, /scripts\/diagnose-deploy-ssh\.js/);
  assert.match(source, /scripts\/print-cloud-blockers\.js/);
  assert.match(source, /forbiddenRootDuplicates/);
  assert.match(source, /main\.js/);
  assert.match(source, /desktop-bridge-permission\.js/);
  assert.match(source, /Unexpected root-level duplicate source file/);
});

test("cloud bridge remote run is account-authenticated and does not add a separate local approval gate", () => {
  const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
  const body = mainSource.match(/async function runCloudBridgeRequest\(ws, message = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.ok(body, "runCloudBridgeRequest should exist");
  assert.doesNotMatch(body, /confirmCloudBridgeRun\(/);
  assert.doesNotMatch(body, /等待本机权限确认/);
  assert.match(body, /permissionMode: "default"/);
});

test("cloud desktop sync lives behind a main/cloud Module instead of main.js", () => {
  const mainSource = fs.readFileSync(path.join(root, "src/main.js"), "utf8");
  const syncSource = fs.readFileSync(path.join(root, "src/main/cloud/desktop-sync-client.js"), "utf8");
  assert.match(syncSource, /function createCloudDesktopSyncClient/, "cloud desktop sync Module should exist");
  assert.match(mainSource, /createCloudDesktopSyncClient/, "main should instantiate the cloud desktop sync Module");
  assert.doesNotMatch(mainSource, /async function cloudApi/, "main must not own low-level cloud HTTP requests");
  assert.doesNotMatch(mainSource, /async function syncAimashiCloudWorkspace/, "main must not own workspace sync orchestration");
  assert.doesNotMatch(mainSource, /async function pushAllFellowSessionsToCloudRooms/, "main must not own fellow room backfill");
  assert.doesNotMatch(mainSource, /async function mirrorFellowSessionToCloudRoom/, "main must not own fellow-room message mirroring");
});
