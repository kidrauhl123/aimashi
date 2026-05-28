const { test } = require("node:test");
const assert = require("node:assert/strict");

const { createHermesRunsClient } = require("../src/cloud-agent/hermes-runs-client.js");

test("runChat passes fellow display name and persona instructions to Hermes", async () => {
  const requests = [];
  const client = createHermesRunsClient({
    async fetch(url, options = {}) {
      requests.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null });
      if (String(url).endsWith("/v1/runs")) {
        return new Response(JSON.stringify({ run_id: "run_1" }), { status: 200 });
      }
      return new Response("data: {\"type\":\"run.completed\",\"content\":\"ok\"}\n\n", { status: 200 });
    }
  });

  await client.runChat({
    baseUrl: "http://worker",
    apiKey: "k",
    userId: "user_1",
    conversationId: "g_1",
    fellow: {
      id: "kongling",
      name: "空铃",
      personaText: "你是空铃，群聊里的 Fellow。"
    },
    input: "空铃在干啥"
  });

  assert.equal(requests[0].body.metadata.display_name, "空铃");
  assert.equal(requests[0].body.instructions, "你是空铃，群聊里的 Fellow。");
});
