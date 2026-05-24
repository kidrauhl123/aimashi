const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createAimashiCloudServer } = require("../scripts/serve-cloud.js");

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function jsonFetch(baseUrl, requestPath, options = {}) {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

test("POST /api/rooms/:id/messages appends cloud fellow reply through existing room messages", async () => {
  const dataDir = tempDir("aimashi-cloud-agent-server-");
  const hermesCalls = [];
  const server = createAimashiCloudServer({
    dataDir,
    cloudAgentWorkerManager: {
      async ensureWorker(userId) {
        return {
          userId,
          baseUrl: "http://worker",
          apiKey: "k",
          paths: { attachments: path.join(dataDir, "agent-users", userId, "attachments") }
        };
      }
    },
    cloudAgentHermesClient: {
      async runChat(args) {
        hermesCalls.push(args);
        return { runId: "hr_server_1", content: "server cloud reply", events: [] };
      }
    }
  });
  const baseUrl = await listen(server);
  try {
    const account = await jsonFetch(baseUrl, "/api/auth/register", {
      method: "POST",
      body: { username: "alice", password: "123456" }
    });
    const roomId = `fellow:${account.user.id}:aimashi`;
    const authHeaders = { authorization: `Bearer ${account.token}` };

    const sent = await jsonFetch(baseUrl, `/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: authHeaders,
      body: {
        bodyMd: "hi cloud",
        clientOpId: "op_cloud_1",
        attachments: [{
          name: "pixel.png",
          dataUrl: `data:image/png;base64,${Buffer.from("png").toString("base64")}`
        }]
      }
    });
    assert.equal(sent.message.sender_kind, "user");
    const sentAttachments = JSON.parse(sent.message.attachments_json);
    assert.equal(sentAttachments.length, 1);
    assert.match(sentAttachments[0].url, /^\/api\/files\/file_/);
    assert.equal(sentAttachments[0].dataUrl, undefined);

    await server.aimashi.cloudAgentDispatcher.idle();

    const listed = await jsonFetch(baseUrl, `/api/rooms/${roomId}/messages`, {
      headers: authHeaders
    });
    assert.deepEqual(listed.messages.map((m) => m.sender_kind), ["user", "fellow"]);
    assert.equal(listed.messages[1].sender_ref, "aimashi");
    assert.equal(listed.messages[1].body_md, "server cloud reply");
    assert.equal(hermesCalls.length, 1);
    assert.match(hermesCalls[0].input, /附件上下文/);
    assert.equal(hermesCalls[0].attachments.length, 1);
    assert.equal(hermesCalls[0].attachments[0].path.startsWith("/data/attachments/"), true);
  } finally {
    await close(server);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
