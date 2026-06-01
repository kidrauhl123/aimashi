const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "web", "app.js"), "utf8");
const appHtml = fs.readFileSync(path.join(__dirname, "..", "src", "web", "app", "index.html"), "utf8");

test("web bootstrap requests compact identity payloads before rendering conversations", () => {
  assert.match(appSource, /api\("\/api\/me\?compact=1"\)/);
  assert.match(appSource, /api\("\/api\/me\/fellows\?compact=1"\)/);
});

test("web bootstrap hydrates full avatar identities after the compact first paint", () => {
  assert.match(appSource, /function hydrateFullIdentities\(/);
  assert.match(appSource, /api\("\/api\/me"\)/);
  assert.match(appSource, /api\("\/api\/me\/fellows"\)/);
  assert.match(appSource, /hydrateFullIdentities\(\)\.catch/);
});

test("web app shell cache-busts the avatar identity app bundle", () => {
  assert.match(appHtml, /src="\.\.\/app\.js\?v=20260601-avatar-root"/);
});
