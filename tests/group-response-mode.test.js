const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("group response mode defaults to conductor and normalizes known values", () => {
  const {
    GROUP_RESPONSE_MODE,
    normalizeGroupResponseMode,
    groupResponseMode,
  } = require("../src/renderer/group/response-mode.js");

  assert.equal(GROUP_RESPONSE_MODE.Conductor, "conductor");
  assert.equal(GROUP_RESPONSE_MODE.MentionsOnly, "mentions-only");
  assert.equal(normalizeGroupResponseMode("mentions-only"), "mentions-only");
  assert.equal(normalizeGroupResponseMode("bogus"), "conductor");
  assert.equal(groupResponseMode({ decorations: { responseMode: "mentions-only" } }), "mentions-only");
  assert.equal(groupResponseMode({ decorations: {} }), "conductor");
});

test("group settings dialog exposes the response mode segmented control", () => {
  const html = fs.readFileSync(path.join(root, "src/renderer/index.html"), "utf8");
  const groupsCss = fs.readFileSync(path.join(root, "src/renderer/styles/groups.css"), "utf8");

  assert.match(html, /id="groupInfoResponseMode"/);
  assert.match(html, /data-group-response-mode="conductor"/);
  assert.match(html, /data-group-response-mode="mentions-only"/);
  assert.match(groupsCss, /\.group-info-settings-card/);
  assert.match(groupsCss, /\.group-response-mode-option/);
});

test("group settings keeps permanent controls minimal", () => {
  const html = fs.readFileSync(path.join(root, "src/renderer/index.html"), "utf8");
  const groupJs = fs.readFileSync(path.join(root, "src/renderer/group/group.js"), "utf8");
  const groupsCss = fs.readFileSync(path.join(root, "src/renderer/styles/groups.css"), "utf8");

  assert.doesNotMatch(html, /groupInfoNameSave/);
  assert.doesNotMatch(html, /groupInfoGoalSave/);
  assert.doesNotMatch(html, /groupInfoHost/);
  assert.match(html, /id="groupInfoAddMemberToggle"/);
  assert.match(groupJs, /data-group-member-action/);
  assert.match(groupJs, /avatarThumbBackgroundStyle/);
  assert.match(groupsCss, /\.group-info-member-action-menu/);
  assert.match(groupsCss, /\.group-info-addable\.hidden/);
});
