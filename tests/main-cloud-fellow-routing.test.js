const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("main wires the desktop fellow runtime dispatcher and listens for invocation requests", () => {
  const main = read("src/main.js");
  const routedSource = `${main}\n${read("src/main/cloud/cloud-events-client.js")}`;

  assert.match(main, /createLocalFellowResponder/);
  assert.match(main, /createMainFellowRuntimeDispatcher/);
  assert.doesNotMatch(main, /createMainGroupConductor/);
  assert.doesNotMatch(main, /createMainFellowConversationResponder/);
  assert.match(
    routedSource,
    /message\.type === CloudEvent\.ConversationFellowInvocationRequested[\s\S]*fellowRuntimeDispatcher\?\.handleCloudEvent\?\.\(message\)/
  );
  const dispatcher = read("src/main/social/fellow-runtime-dispatcher.js");
  assert.match(dispatcher, /localFellowResponder\.respond/);
  assert.doesNotMatch(dispatcher, /mainGroupConductor/);
  assert.doesNotMatch(dispatcher, /mainFellowConversationResponder/);
});

test("renderer no longer executes local fellow replies for cloud conversation events", () => {
  const social = read("src/renderer/social/social.js");
  const groups = read("src/renderer/social/social-groups.js");
  const html = read("src/renderer/index.html");

  assert.equal(
    /window\.miaGroupConductor\.handleConversationMessageAppended/.test(social),
    false,
    "renderer must not run conductor dispatch from conversation.message_appended"
  );
  assert.equal(
    /handleFellowInvocation\(payload\)/.test(social),
    false,
    "renderer must not run explicit @ fellow invocation from cloud events"
  );
  assert.equal(
    /group-conductor\.js/.test(html),
    false,
    "renderer must not load the old conductor script after main owns conductor execution"
  );
  assert.equal(
    /sendChatStateless|postConversationMessageAsFellow|handleFellowInvocation/.test(groups),
    false,
    "renderer social-groups must not retain local engine invocation code"
  );
});
