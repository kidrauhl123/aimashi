# 独立 Mobile 视图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Mia 仓库里新增一个独立的、触摸优先的 mobile 视图,复用云端 REST/WebSocket + `shared/*` 模块,跑通聊天 / 权限审批(底部 sheet)/ trace,并用 Capacitor 打成原生壳。

**Architecture:** 网络层收敛到新模块 `src/shared/cloud-client.js`(REST + WebSocket 事件流);mobile 控制器的纯逻辑拆成可在 node 下单测的小模块 `src/mobile/lib/*`;DOM 视图层(`src/mobile/{index.html,app.js,styles.css}`)全新写,在浏览器里靠 `scripts/serve-mobile.js` 验证;`scripts/build-mobile-www.js` 把视图 + 依赖的 shared 模块拼进 `dist/mobile-www/`,Capacitor 工程 `mobile-app/` 以此为 `webDir` 打包。

**Tech Stack:** 纯 JS(无打包器,沿用仓库 UMD-ish 全局模块约定:`(function(root,factory){...})`);`node --test` 单测;`http` dev server(照搬 `scripts/serve-web.js`);Capacitor(iOS/Android 壳)。

**Spec:** `docs/superpowers/specs/2026-06-01-mobile-view-design.md`

---

## File Structure

```
src/shared/cloud-client.js                [新增] 唯一网络层:REST + WS 事件
src/mobile/lib/conversation-list-model.js  [新增] 会话列表排序/末句/未读(纯函数)
src/mobile/lib/approval-queue.js           [新增] 待审批队列状态机(纯函数)
src/mobile/lib/optimistic-send.js          [新增] 乐观发送 + ack 对账(纯函数)
src/mobile/index.html                      [重写] 登录 + 底部 Tab 壳 + 聊天视图
src/mobile/app.js                          [重写] DOM 控制器(组合上面所有模块)
src/mobile/styles.css                      [重写] 触摸优先 + 安全区 + Tab + sheet
src/mobile/manifest.json                   [保留/精简]
scripts/build-mobile-www.js                [新增] 拼装 dist/mobile-www/
scripts/serve-mobile.js                    [新增] 浏览器 dev server + /api 代理
mobile-app/capacitor.config.json           [新增] Capacitor 配置
tests/mobile-cloud-client.test.js          [新增]
tests/mobile-conversation-list-model.test.js [新增]
tests/mobile-approval-queue.test.js        [新增]
tests/mobile-optimistic-send.test.js       [新增]
```

约定核对(已验证):shared 模块用 `(function attach(root, factory){ const api=factory(); if (typeof module==="object"&&module.exports) module.exports=api; if(root) root.miaXxx=api; })(typeof window!=="undefined"?window:globalThis, function(){...})`。测试用 `node --test`,`npm test` 跑 `tests/*.test.js`。

---

## Task 1: cloud-client REST 核心

**Files:**
- Create: `src/shared/cloud-client.js`
- Test: `tests/mobile-cloud-client.test.js`

- [ ] **Step 1: 写失败测试**

```js
// tests/mobile-cloud-client.test.js
const test = require("node:test");
const assert = require("node:assert");
const { createCloudClient } = require("../src/shared/cloud-client");

test("api(): GET 带 Bearer,无 clientOpId", async () => {
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200, json: async () => ({ ok: 1 }) };
  };
  const client = createCloudClient({ apiBase: "https://c.test", fetchImpl: fakeFetch, getToken: () => "T" });
  const data = await client.api("/api/me");
  assert.equal(data.ok, 1);
  assert.equal(calls[0].url, "https://c.test/api/me");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer T");
  assert.equal(calls[0].opts.body, undefined);
});

test("api(): POST 对象 body 自动注入 clientOpId 并 JSON 序列化", async () => {
  let seen;
  const fakeFetch = async (url, opts) => { seen = opts; return { ok: true, status: 200, json: async () => ({}) }; };
  const client = createCloudClient({ apiBase: "https://c.test", fetchImpl: fakeFetch, getToken: () => "", idFactory: () => "op_fixed" });
  await client.api("/api/x", { method: "POST", body: { a: 1 } });
  const parsed = JSON.parse(seen.body);
  assert.equal(parsed.a, 1);
  assert.equal(parsed.clientOpId, "op_fixed");
  assert.equal(seen.headers.Authorization, undefined);
});

test("api(): 预置 clientOpId 不被覆盖", async () => {
  let seen;
  const fakeFetch = async (url, opts) => { seen = opts; return { ok: true, status: 200, json: async () => ({}) }; };
  const client = createCloudClient({ apiBase: "https://c.test", fetchImpl: fakeFetch, getToken: () => "", idFactory: () => "op_new" });
  await client.api("/api/x", { method: "PUT", body: { clientOpId: "op_keep" } });
  assert.equal(JSON.parse(seen.body).clientOpId, "op_keep");
});

test("api(): 非 2xx 抛出 data.error", async () => {
  const fakeFetch = async () => ({ ok: false, status: 403, json: async () => ({ error: "no" }) });
  const client = createCloudClient({ apiBase: "https://c.test", fetchImpl: fakeFetch, getToken: () => "" });
  await assert.rejects(() => client.api("/api/x"), /no/);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/mobile-cloud-client.test.js`
Expected: FAIL（`Cannot find module '../src/shared/cloud-client'`）

- [ ] **Step 3: 实现 REST 核心**

```js
// src/shared/cloud-client.js
(function attachCloudClient(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaCloudClient = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function buildCloudClient() {
  function defaultIdFactory() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `op_${crypto.randomUUID()}`;
    return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  // deps: { apiBase, fetchImpl?, getToken, idFactory? }
  // apiBase 例如 "https://cloud.mia.app"(无尾斜杠)。getToken() 返回当前 Bearer token 或 ""。
  function createCloudClient(deps) {
    const apiBase = String(deps.apiBase || "").replace(/\/+$/, "");
    const fetchImpl = deps.fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
    const getToken = deps.getToken || (() => "");
    const idFactory = deps.idFactory || defaultIdFactory;
    if (!fetchImpl) throw new Error("cloud-client: no fetch implementation");

    async function api(path, options = {}) {
      const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      let body = options.body;
      const method = String(options.method || "GET").toUpperCase();
      const mutating = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
      if (mutating && body && typeof body === "object" && !body.clientOpId) {
        body = { ...body, clientOpId: idFactory() };
      }
      const response = await fetchImpl(`${apiBase}${path}`, {
        ...options,
        headers,
        body: body && typeof body !== "string" ? JSON.stringify(body) : body
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      return data;
    }

    return { api, apiBase };
  }

  return { createCloudClient };
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/mobile-cloud-client.test.js`
Expected: PASS（4 tests）

- [ ] **Step 5: 提交**

```bash
git add src/shared/cloud-client.js tests/mobile-cloud-client.test.js
git commit -m "feat(mobile): cloud-client REST core with clientOpId idempotency"
```

---

## Task 2: cloud-client WebSocket 事件层

**Files:**
- Modify: `src/shared/cloud-client.js`
- Test: `tests/mobile-cloud-client.test.js`

- [ ] **Step 1: 追加失败测试**

```js
// 追加到 tests/mobile-cloud-client.test.js 末尾
test("eventsUrl(): http→ws, https→wss, 带 since_seq", () => {
  const { eventsUrlFor } = require("../src/shared/cloud-client");
  assert.equal(eventsUrlFor("https://c.test", 7), "wss://c.test/api/events?since_seq=7");
  assert.equal(eventsUrlFor("http://c.test", 0), "ws://c.test/api/events?since_seq=0");
});

test("backoffMs(): 指数退避并封顶 30s", () => {
  const { backoffMs } = require("../src/shared/cloud-client");
  assert.equal(backoffMs(0), 1000);
  assert.equal(backoffMs(1), 2000);
  assert.equal(backoffMs(2), 4000);
  assert.equal(backoffMs(10), 30000);
});

test("WS 客户端:连接用 mia-token subprotocol,分发 message,断线调度重连", () => {
  const { createCloudClient } = require("../src/shared/cloud-client");
  const sockets = [];
  class FakeWS {
    constructor(url, protocols) { this.url = url; this.protocols = protocols; this.listeners = {}; sockets.push(this); }
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
    close() { this.closed = true; (this.listeners.close || []).forEach((fn) => fn({})); }
    emit(t, ev) { (this.listeners[t] || []).forEach((fn) => fn(ev)); }
  }
  const scheduled = [];
  const got = [];
  const client = createCloudClient({
    apiBase: "https://c.test", fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    getToken: () => "TK", WebSocketImpl: FakeWS,
    scheduleReconnect: (fn) => scheduled.push(fn)
  });
  client.connectEvents({ sinceSeq: () => 3, onEvent: (e) => got.push(e) });
  assert.equal(sockets[0].url, "wss://c.test/api/events?since_seq=3");
  assert.deepEqual(sockets[0].protocols, ["mia-token.TK"]);
  sockets[0].emit("message", { data: JSON.stringify({ type: "x", seq: 4 }) });
  assert.equal(got[0].type, "x");
  sockets[0].emit("close", {});
  assert.equal(scheduled.length, 1); // 断线触发一次重连调度
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/mobile-cloud-client.test.js`
Expected: FAIL（`eventsUrlFor is not a function` / `connectEvents` undefined）

- [ ] **Step 3: 追加 WS 实现**

在 `buildCloudClient()` 内、`createCloudClient` 之前加纯函数:

```js
  function eventsUrlFor(apiBase, sinceSeq) {
    const base = String(apiBase || "").replace(/\/+$/, "");
    const wsBase = base.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    return `${wsBase}/api/events?since_seq=${Number(sinceSeq) || 0}`;
  }
  function backoffMs(attempt) {
    return Math.min(30000, 1000 * Math.pow(2, Math.max(0, attempt)));
  }
```

在 `createCloudClient` 的 deps 解构里追加：`const WS = deps.WebSocketImpl || (typeof WebSocket !== "undefined" ? WebSocket : null);` 和 `const scheduleReconnect = deps.scheduleReconnect || ((fn) => setTimeout(fn, 1000));`。

在 `return { api, apiBase }` 之前加：

```js
    let socket = null;
    let stopped = false;
    let attempt = 0;

    // opts: { sinceSeq: () => number, onEvent: (envelope) => void, onStatus?: (s) => void }
    function connectEvents(opts) {
      stopped = false;
      const token = getToken();
      if (!token || !WS) return;
      disconnectEvents();
      let s;
      try {
        s = new WS(eventsUrlFor(apiBase, opts.sinceSeq ? opts.sinceSeq() : 0), ["mia-token." + token]);
      } catch (err) {
        if (!stopped) scheduleReconnect(() => connectEvents(opts), backoffMs(attempt++));
        return;
      }
      socket = s;
      if (opts.onStatus) opts.onStatus("connecting");
      s.addEventListener("open", () => { attempt = 0; if (opts.onStatus) opts.onStatus("open"); });
      s.addEventListener("message", (event) => {
        if (socket !== s) return;
        let envelope; try { envelope = JSON.parse(event.data); } catch { return; }
        opts.onEvent(envelope);
      });
      const onDown = () => {
        if (socket !== s) return;
        socket = null;
        if (opts.onStatus) opts.onStatus("down");
        if (!stopped) scheduleReconnect(() => connectEvents(opts), backoffMs(attempt++));
      };
      s.addEventListener("close", onDown);
      s.addEventListener("error", onDown);
    }
    function disconnectEvents() {
      const s = socket; socket = null;
      if (s) { try { s.close(); } catch {} }
    }
    function stopEvents() { stopped = true; disconnectEvents(); }
```

并把返回改为：`return { api, apiBase, connectEvents, disconnectEvents, stopEvents };`
另外在 `buildCloudClient` 的最终 `return` 里追加导出：`return { createCloudClient, eventsUrlFor, backoffMs };`

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/mobile-cloud-client.test.js`
Expected: PASS（7 tests）

- [ ] **Step 5: 提交**

```bash
git add src/shared/cloud-client.js tests/mobile-cloud-client.test.js
git commit -m "feat(mobile): cloud-client WebSocket events with backoff reconnect"
```

---

## Task 3: 会话列表模型(纯函数)

**Files:**
- Create: `src/mobile/lib/conversation-list-model.js`
- Test: `tests/mobile-conversation-list-model.test.js`

- [ ] **Step 1: 写失败测试**

```js
// tests/mobile-conversation-list-model.test.js
const test = require("node:test");
const assert = require("node:assert");
const { buildConversationListItems } = require("../src/mobile/lib/conversation-list-model");

test("按最后活动时间倒序,带未读数与末句", () => {
  const items = buildConversationListItems({
    conversations: [
      { id: "dm:a", name: "Alice", last_message_text: "hi", last_activity_at: "2026-06-01T10:00:00Z" },
      { id: "fellow::bob", name: "Bob", last_message_text: "done", last_activity_at: "2026-06-01T12:00:00Z" }
    ],
    unreadByConversation: { "dm:a": 3 }
  });
  assert.equal(items[0].id, "fellow::bob"); // 更晚 → 排前
  assert.equal(items[0].unread, 0);
  assert.equal(items[1].id, "dm:a");
  assert.equal(items[1].unread, 3);
  assert.equal(items[1].subtitle, "hi");
});

test("缺字段时安全降级", () => {
  const items = buildConversationListItems({ conversations: [{ id: "dm:x" }], unreadByConversation: {} });
  assert.equal(items[0].title, "dm:x");
  assert.equal(items[0].subtitle, "");
  assert.equal(items[0].unread, 0);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/mobile-conversation-list-model.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```js
// src/mobile/lib/conversation-list-model.js
(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaConversationListModel = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function () {
  function activityTime(c) {
    const t = c.last_activity_at || c.updated_at || c.created_at || "";
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : 0;
  }
  // deps: { conversations: [], unreadByConversation: { [id]: n } }
  function buildConversationListItems(deps) {
    const convs = Array.isArray(deps.conversations) ? deps.conversations.slice() : [];
    const unread = deps.unreadByConversation || {};
    convs.sort((a, b) => activityTime(b) - activityTime(a));
    return convs.map((c) => ({
      id: c.id,
      title: c.name || c.title || c.id,
      subtitle: String(c.last_message_text || ""),
      unread: Number(unread[c.id]) || 0,
      raw: c
    }));
  }
  return { buildConversationListItems };
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/mobile-conversation-list-model.test.js`
Expected: PASS（2 tests）

- [ ] **Step 5: 提交**

```bash
git add src/mobile/lib/conversation-list-model.js tests/mobile-conversation-list-model.test.js
git commit -m "feat(mobile): conversation list model"
```

---

## Task 4: 待审批队列状态机(纯函数)

**Files:**
- Create: `src/mobile/lib/approval-queue.js`
- Test: `tests/mobile-approval-queue.test.js`

底部 sheet 同时只展示一条待审批;队列保证多条按到达顺序逐条处理,响应/失效后弹出下一条。

- [ ] **Step 1: 写失败测试**

```js
// tests/mobile-approval-queue.test.js
const test = require("node:test");
const assert = require("node:assert");
const { createApprovalQueue } = require("../src/mobile/lib/approval-queue");

test("request 入队,active 为最早一条", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1", preview: "rm -rf" });
  q.onRequest({ conversationId: "c1", runId: "r2", preview: "ls" });
  assert.equal(q.active().runId, "r1");
  assert.equal(q.size(), 2);
});

test("resolve 当前条后 active 前进", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1" });
  q.onRequest({ conversationId: "c1", runId: "r2" });
  q.resolve("r1");
  assert.equal(q.active().runId, "r2");
});

test("responded 事件等价于移除该条", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1" });
  q.onResponded("r1");
  assert.equal(q.active(), null);
  assert.equal(q.size(), 0);
});

test("重复 request 同 runId 不重复入队", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1", preview: "a" });
  q.onRequest({ conversationId: "c1", runId: "r1", preview: "a" });
  assert.equal(q.size(), 1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/mobile-approval-queue.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```js
// src/mobile/lib/approval-queue.js
(function attach(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaApprovalQueue = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function () {
  function createApprovalQueue() {
    let items = []; // [{ conversationId, runId, preview }]
    function remove(runId) { items = items.filter((it) => it.runId !== runId); }
    return {
      onRequest(req) {
        if (!req || !req.runId) return;
        if (items.some((it) => it.runId === req.runId)) return;
        items.push({ conversationId: req.conversationId || "", runId: req.runId, preview: req.preview || "" });
      },
      onResponded(runId) { remove(runId); },
      resolve(runId) { remove(runId); },
      active() { return items.length ? items[0] : null; },
      size() { return items.length; }
    };
  }
  return { createApprovalQueue };
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/mobile-approval-queue.test.js`
Expected: PASS（4 tests）

- [ ] **Step 5: 提交**

```bash
git add src/mobile/lib/approval-queue.js tests/mobile-approval-queue.test.js
git commit -m "feat(mobile): approval queue state machine"
```

---

## Task 5: 乐观发送 + ack 对账(纯函数)

**Files:**
- Create: `src/mobile/lib/optimistic-send.js`
- Test: `tests/mobile-optimistic-send.test.js`

复用 `shared/send-pipeline.js` 的 `prepareOutgoingMessage`(校验 + clientTraceId + mentions),本模块负责生成 pending 气泡模型,并在 ack/广播回来时按 `clientTraceId` 对账落定。

- [ ] **Step 1: 写失败测试**

```js
// tests/mobile-optimistic-send.test.js
const test = require("node:test");
const assert = require("node:assert");
const { buildPendingMessage, reconcilePending } = require("../src/mobile/lib/optimistic-send");

test("buildPendingMessage 生成 pending 气泡(含 clientTraceId)", () => {
  const pending = buildPendingMessage({ text: "hello" }, { selfId: "u1" });
  assert.equal(pending.bodyMd, "hello");
  assert.equal(pending.isOwn, true);
  assert.equal(pending.isPending, true);
  assert.ok(pending.clientTraceId);
});

test("空文本抛 EMPTY_MESSAGE", () => {
  assert.throws(() => buildPendingMessage({ text: "  " }, { selfId: "u1" }), /EMPTY_MESSAGE|empty/);
});

test("reconcilePending: 按 clientTraceId 把 pending 换成服务端消息", () => {
  const list = [{ messageId: "p1", clientTraceId: "t1", isPending: true }];
  const server = { id: "s1", client_trace_id: "t1", body_md: "hi" };
  const next = reconcilePending(list, server);
  assert.equal(next.length, 1);
  assert.equal(next[0].messageId, "s1");
  assert.equal(next[0].isPending, false);
});

test("reconcilePending: 无匹配 trace 时追加新消息", () => {
  const list = [{ messageId: "p1", clientTraceId: "t1", isPending: true }];
  const server = { id: "s2", client_trace_id: "tX", body_md: "yo" };
  const next = reconcilePending(list, server);
  assert.equal(next.length, 2);
  assert.equal(next[1].messageId, "s2");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test tests/mobile-optimistic-send.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

```js
// src/mobile/lib/optimistic-send.js
(function attach(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaOptimisticSend = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function (root) {
  function sendPipeline() {
    if (root && root.miaSendPipeline) return root.miaSendPipeline;
    if (typeof require === "function") return require("../../shared/send-pipeline");
    throw new Error("optimistic-send: send-pipeline 未加载");
  }
  // input: { text, attachments?, replyTo? }; ctx: { selfId, members? }
  function buildPendingMessage(input, ctx) {
    const { prepareOutgoingMessage } = sendPipeline();
    const prepared = prepareOutgoingMessage(input, { members: ctx && ctx.members });
    return {
      messageId: `pending:${prepared.clientTraceId}`,
      clientTraceId: prepared.clientTraceId,
      bodyMd: prepared.bodyMd,
      attachments: prepared.attachments,
      mentions: prepared.mentions,
      role: "user",
      isOwn: true,
      isPending: true,
      createdAt: ""
    };
  }
  // 把服务端确认/广播的行并入列表:命中 clientTraceId 则替换 pending,否则追加
  function reconcilePending(list, serverRow) {
    const trace = serverRow.client_trace_id || serverRow.clientTraceId || "";
    const next = Array.isArray(list) ? list.slice() : [];
    const idx = trace ? next.findIndex((m) => m.clientTraceId && m.clientTraceId === trace) : -1;
    const merged = {
      messageId: serverRow.id || (trace ? `pending:${trace}` : ""),
      clientTraceId: trace,
      bodyMd: String(serverRow.body_md || serverRow.bodyMd || ""),
      role: "user",
      isOwn: true,
      isPending: false,
      createdAt: serverRow.created_at || ""
    };
    if (idx >= 0) next[idx] = { ...next[idx], ...merged };
    else next.push(merged);
    return next;
  }
  return { buildPendingMessage, reconcilePending };
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test tests/mobile-optimistic-send.test.js`
Expected: PASS（4 tests）

- [ ] **Step 5: 提交**

```bash
git add src/mobile/lib/optimistic-send.js tests/mobile-optimistic-send.test.js
git commit -m "feat(mobile): optimistic send + ack reconciliation"
```

---

## Task 6: 全量回归 + 删除旧 mobile 实现

**Files:**
- Delete (内容重写): `src/mobile/app.js`, `src/mobile/index.html`, `src/mobile/styles.css`

旧 `src/mobile/*` 是「填本机地址 + 配对 token」的废弃模型。在重写视图层前先清空,避免混淆。

- [ ] **Step 1: 跑全量测试基线**

Run: `npm test`
Expected: PASS（既有测试全绿 + 新增 4 个 mobile 测试文件全绿）

- [ ] **Step 2: 清空旧实现(占位以待重写)**

```bash
: > src/mobile/app.js
: > src/mobile/styles.css
```

`index.html` 在 Task 7 整体重写,这里不动。

- [ ] **Step 3: 提交**

```bash
git add -A src/mobile
git commit -m "chore(mobile): clear legacy local-pairing mobile client for rewrite"
```

---

## Task 7: 视图骨架 — index.html

**Files:**
- Create (重写): `src/mobile/index.html`

加载顺序必须满足 shared 模块的全局依赖(message-spec / contact / avatar-resolve 等先于 cloud-conversation-source)。

- [ ] **Step 1: 写 index.html**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
  <meta name="theme-color" content="#f5f5f8">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Mia</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <!-- 登录视图 -->
  <section id="loginView" class="login-view">
    <div class="login-panel">
      <h1>Mia</h1>
      <input id="serverInput" inputmode="url" placeholder="服务器(默认生产)">
      <input id="usernameInput" type="text" autocomplete="username" placeholder="用户名">
      <input id="passwordInput" type="password" autocomplete="current-password" placeholder="密码">
      <button id="loginBtn" class="primary" type="button">登录</button>
      <button id="registerBtn" type="button">创建账号</button>
      <p id="loginError" class="error"></p>
    </div>
  </section>

  <!-- 主壳 -->
  <section id="mainView" class="main-view hidden">
    <!-- 列表视图(消息 Tab) -->
    <div id="listScreen" class="screen">
      <header class="bar"><span class="bar-title">消息</span></header>
      <div id="connBar" class="conn-bar hidden">连接中…</div>
      <ul id="conversationList" class="conv-list"></ul>
    </div>

    <!-- 聊天视图 -->
    <div id="chatScreen" class="screen hidden">
      <header class="bar">
        <button id="chatBack" class="back" type="button" aria-label="返回">‹</button>
        <span id="chatTitle" class="bar-title"></span>
      </header>
      <div id="chatMessages" class="chat-messages"></div>
      <div id="composer" class="composer">
        <input id="composerInput" type="text" placeholder="输入消息…">
        <button id="sendBtn" class="primary" type="button">发送</button>
      </div>
      <!-- 权限底部 sheet -->
      <div id="approvalSheet" class="approval-sheet hidden">
        <div class="approval-title">⚠ 请求权限</div>
        <div id="approvalPreview" class="approval-preview"></div>
        <div class="approval-actions">
          <button data-decision="deny" type="button">拒绝</button>
          <button data-decision="allow_once" class="primary" type="button">允许</button>
          <button data-decision="allow_always" type="button">始终</button>
        </div>
      </div>
    </div>

    <!-- 联系人 / 我(MVP 占位,后续 Task 可扩) -->
    <div id="contactsScreen" class="screen hidden"><header class="bar"><span class="bar-title">联系人</span></header><ul id="contactsList" class="conv-list"></ul></div>
    <div id="meScreen" class="screen hidden"><header class="bar"><span class="bar-title">我</span></header><div class="me-body"><div id="meName"></div><button id="logoutBtn" type="button">退出登录</button></div></div>

    <!-- 底部 Tab -->
    <nav id="tabBar" class="tab-bar">
      <button class="tab active" data-tab="list" type="button"><span>💬</span>消息</button>
      <button class="tab" data-tab="contacts" type="button"><span>👥</span>联系人</button>
      <button class="tab" data-tab="me" type="button"><span>⚙</span>我</button>
    </nav>
  </section>

  <!-- shared 依赖(顺序敏感)。build-mobile-www 会把这些拼成扁平路径 -->
  <script src="./shared/conversation-kinds.js"></script>
  <script src="./shared/message-spec.js"></script>
  <script src="./shared/contact.js"></script>
  <script src="./shared/avatar-resolve.js"></script>
  <script src="./shared/unread.js"></script>
  <script src="./shared/send-pipeline.js"></script>
  <script src="./shared/agent-permissions.js"></script>
  <script src="./shared/trace-blocks.js"></script>
  <script src="./shared/cloud-client.js"></script>
  <script src="./message-sources/cloud-conversation-source.js"></script>
  <script src="./lib/conversation-list-model.js"></script>
  <script src="./lib/approval-queue.js"></script>
  <script src="./lib/optimistic-send.js"></script>
  <script src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add src/mobile/index.html
git commit -m "feat(mobile): view shell html (login + bottom tabs + chat)"
```

---

## Task 8: 样式 — styles.css

**Files:**
- Create (重写): `src/mobile/styles.css`

- [ ] **Step 1: 写 styles.css**

```css
:root { --bg:#f5f5f8; --card:#fff; --accent:#7c5cff; --line:#e8e8ee; --muted:#999; --danger:#e0524d; }
* { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
html,body { margin:0; height:100%; font:15px/1.4 -apple-system,system-ui,"Helvetica Neue",sans-serif; background:var(--bg); color:#1c1c1e; }
.hidden { display:none !important; }
button { font:inherit; cursor:pointer; border:1px solid var(--line); background:var(--card); border-radius:10px; padding:9px 14px; }
button.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
input { font:inherit; padding:11px 12px; border:1px solid var(--line); border-radius:10px; width:100%; }

/* 登录 */
.login-view { min-height:100%; display:flex; align-items:center; justify-content:center; padding:24px; }
.login-panel { width:100%; max-width:360px; display:flex; flex-direction:column; gap:12px; }
.login-panel h1 { text-align:center; margin:0 0 8px; }
.error { color:var(--danger); min-height:1.2em; margin:0; font-size:13px; }

/* 主壳:全屏 + 底部安全区 */
.main-view { position:fixed; inset:0; display:flex; flex-direction:column; }
.screen { position:absolute; inset:0 0 calc(56px + env(safe-area-inset-bottom)) 0; display:flex; flex-direction:column; }
.bar { display:flex; align-items:center; gap:6px; padding:calc(8px + env(safe-area-inset-top)) 14px 8px; background:var(--card); border-bottom:1px solid var(--line); font-weight:600; }
.bar-title { font-weight:600; }
.back { border:none; background:none; font-size:26px; line-height:1; padding:0 6px 0 0; color:var(--accent); }
.conn-bar { background:#fff7ed; color:#b45309; text-align:center; font-size:13px; padding:5px; }

/* 会话列表 */
.conv-list { list-style:none; margin:0; padding:0; overflow:auto; flex:1; }
.conv-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid var(--line); }
.conv-row .conv-text { flex:1; min-width:0; }
.conv-row .conv-title { font-weight:600; }
.conv-row .conv-sub { color:var(--muted); font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.conv-badge { background:var(--accent); color:#fff; border-radius:11px; min-width:20px; height:20px; padding:0 6px; font-size:12px; display:flex; align-items:center; justify-content:center; }
.conv-avatar { width:42px; height:42px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-size:15px; flex:0 0 auto; }

/* 聊天 */
.chat-messages { flex:1; overflow:auto; padding:12px; display:flex; flex-direction:column; gap:8px; }
.msg { max-width:82%; padding:8px 11px; border-radius:14px; background:var(--card); }
.msg.own { align-self:flex-end; background:var(--accent); color:#fff; }
.msg.pending { opacity:.55; }
.msg.failed { border:1px solid var(--danger); }
.composer { display:flex; gap:8px; padding:8px 10px calc(8px + env(safe-area-inset-bottom)); background:var(--card); border-top:1px solid var(--line); }
.composer input { flex:1; }

/* trace 折叠 chip(配合 shared/trace-blocks.js 渲染的 details.trace-row) */
.trace-row { margin:2px 0; }
.trace-row > summary { display:inline-block; background:#eee; border-radius:10px; padding:2px 8px; font-size:12px; color:#555; list-style:none; cursor:pointer; }
.trace-row[open] > summary { margin-bottom:6px; }

/* 权限底部 sheet */
.approval-sheet { position:absolute; left:0; right:0; bottom:0; background:var(--card); border-top:2px solid #f0c89a; border-radius:16px 16px 0 0; padding:14px 14px calc(14px + env(safe-area-inset-bottom)); box-shadow:0 -6px 18px rgba(0,0,0,.1); }
.approval-title { font-weight:600; color:#b45309; margin-bottom:6px; }
.approval-preview { color:#555; font-size:13px; margin-bottom:12px; word-break:break-all; }
.approval-actions { display:flex; gap:8px; }
.approval-actions button { flex:1; }

/* 底部 Tab */
.tab-bar { position:absolute; left:0; right:0; bottom:0; height:calc(56px + env(safe-area-inset-bottom)); padding-bottom:env(safe-area-inset-bottom); display:flex; background:var(--card); border-top:1px solid var(--line); }
.tab { flex:1; border:none; background:none; border-radius:0; display:flex; flex-direction:column; align-items:center; gap:2px; font-size:11px; color:var(--muted); }
.tab.active { color:var(--accent); font-weight:600; }
.me-body { padding:18px; display:flex; flex-direction:column; gap:14px; }
```

- [ ] **Step 2: 提交**

```bash
git add src/mobile/styles.css
git commit -m "feat(mobile): touch-first styles (tabs, chat, sheet, safe-area)"
```

---

## Task 9: 控制器 app.js — 登录 / bootstrap / Tab 路由

**Files:**
- Create (重写): `src/mobile/app.js`

- [ ] **Step 1: 写 app.js 基础部分**

```js
// src/mobile/app.js — DOM 控制器,组合 shared + lib 模块
(function () {
  "use strict";
  const DEFAULT_API_BASE = "https://app.mia.example"; // TODO 部署时改为真实生产域名
  const SS_KEY = "mia.mobile.session";
  const $ = (id) => document.getElementById(id);

  const state = {
    apiBase: DEFAULT_API_BASE,
    token: "",
    user: null,
    conversations: [],
    fellows: [],
    friends: [],
    settings: { readMarks: {}, pins: [], appearance: {} },
    activeConversationId: "",
    messagesByConv: {},   // convId -> [normalizedSpec-ish 行]
    membersByConv: {},
    lastEventSeq: 0,
    tab: "list"
  };

  let client = null;
  const approvals = window.miaApprovalQueue.createApprovalQueue();

  // ── 会话存取 ──
  function loadSession() {
    try {
      const p = JSON.parse(localStorage.getItem(SS_KEY) || "");
      if (p && p.token) { state.token = p.token; state.user = p.user || null; state.apiBase = p.apiBase || DEFAULT_API_BASE; }
    } catch {}
  }
  function saveSession() {
    localStorage.setItem(SS_KEY, JSON.stringify({ token: state.token, user: state.user, apiBase: state.apiBase }));
  }
  function clearSession() {
    state.token = ""; state.user = null; state.conversations = [];
    if (client) client.stopEvents();
    localStorage.removeItem(SS_KEY);
  }

  function makeClient() {
    client = window.miaCloudClient.createCloudClient({
      apiBase: state.apiBase,
      getToken: () => state.token
    });
  }

  // ── 视图切换 ──
  function setLoggedIn(on) {
    $("loginView").classList.toggle("hidden", on);
    $("mainView").classList.toggle("hidden", !on);
  }
  function showTab(tab) {
    state.tab = tab;
    const map = { list: "listScreen", contacts: "contactsScreen", me: "meScreen" };
    Object.values(map).forEach((id) => $(id).classList.add("hidden"));
    $("chatScreen").classList.add("hidden");
    $(map[tab]).classList.remove("hidden");
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  }

  // ── 登录 ──
  async function doAuth(register) {
    const server = $("serverInput").value.trim();
    state.apiBase = server || DEFAULT_API_BASE;
    makeClient();
    const username = $("usernameInput").value.trim();
    const password = $("passwordInput").value;
    $("loginError").textContent = "";
    try {
      const path = register ? "/api/auth/register" : "/api/auth/login";
      const data = await client.api(path, { method: "POST", body: { username, password } });
      state.token = data.token; state.user = data.user || { username };
      saveSession();
      setLoggedIn(true);
      await bootstrap();
    } catch (err) {
      $("loginError").textContent = err.message || "登录失败";
    }
  }

  async function bootstrap() {
    try { const me = await client.api("/api/me?compact=1"); state.user = me.user || me; saveSession(); }
    catch { clearSession(); setLoggedIn(false); return; }
    await Promise.all([
      client.api("/api/conversations").then((d) => { state.conversations = d.conversations || []; }).catch(() => {}),
      client.api("/api/me/fellows?compact=1").then((d) => { state.fellows = d.fellows || []; }).catch(() => {}),
      client.api("/api/social/friends").then((d) => { state.friends = d.friends || []; }).catch(() => {}),
      client.api("/api/me/settings").then((d) => { if (d.settings) state.settings = d.settings; }).catch(() => {})
    ]);
    if ($("meName")) $("meName").textContent = state.user?.username || "";
    renderConversationList();
    startEvents();
  }

  // 占位:后续 Task 实现
  function renderConversationList() {}
  function startEvents() {}

  // ── 事件绑定 ──
  function bindUi() {
    $("loginBtn").addEventListener("click", () => doAuth(false));
    $("registerBtn").addEventListener("click", () => doAuth(true));
    $("logoutBtn")?.addEventListener("click", () => { clearSession(); setLoggedIn(false); });
    document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    $("chatBack").addEventListener("click", () => { $("chatScreen").classList.add("hidden"); showTab("list"); });
  }

  function init() {
    bindUi();
    loadSession();
    if (state.token) { makeClient(); setLoggedIn(true); bootstrap(); }
    else { setLoggedIn(false); $("serverInput").value = ""; }
  }
  document.addEventListener("DOMContentLoaded", init);
  window.__miaMobile = { state };
})();
```

- [ ] **Step 2: 提交**

```bash
git add src/mobile/app.js
git commit -m "feat(mobile): app.js auth + bootstrap + tab routing"
```

---

## Task 10: app.js — 会话列表渲染 + 进入聊天

**Files:**
- Modify: `src/mobile/app.js`

- [ ] **Step 1: 替换 `renderConversationList` 占位并新增 openConversation**

把 Task 9 中的 `function renderConversationList() {}` 替换为:

```js
  function avatarText(title) { return (String(title || "?").trim()[0] || "?").toUpperCase(); }

  function renderConversationList() {
    const items = window.miaConversationListModel.buildConversationListItems({
      conversations: state.conversations,
      unreadByConversation: {} // MVP:未读后续接 shared/unread,先 0
    });
    const ul = $("conversationList");
    ul.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.className = "conv-row";
      li.innerHTML = `<div class="conv-avatar">${avatarText(it.title)}</div>
        <div class="conv-text"><div class="conv-title">${escapeHtml(it.title)}</div>
        <div class="conv-sub">${escapeHtml(it.subtitle)}</div></div>
        ${it.unread ? `<span class="conv-badge">${it.unread}</span>` : ""}`;
      li.addEventListener("click", () => openConversation(it.id, it.title));
      ul.appendChild(li);
    });
  }

  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
  }

  async function openConversation(id, title) {
    state.activeConversationId = id;
    $("chatTitle").textContent = title || "";
    $("chatScreen").classList.remove("hidden");
    document.querySelectorAll(".screen").forEach((s) => { if (s.id !== "chatScreen") s.classList.add("hidden"); });
    try {
      const d = await client.api(`/api/conversations/${encodeURIComponent(id)}/messages?limit=200`);
      state.messagesByConv[id] = (d.messages || []).map(normalizeServerRow);
      const m = await client.api(`/api/conversations/${encodeURIComponent(id)}`);
      state.membersByConv[id] = m.members || [];
    } catch {}
    renderChat();
  }

  // 把服务端消息行转成渲染用的最小结构(MVP;后续可换 cloud-conversation-source)
  function normalizeServerRow(m, idx) {
    const isOwn = m.sender_kind === "user" && m.sender_ref === (state.user && state.user.id);
    return {
      messageId: m.id || `${state.activeConversationId}#${m.seq || idx}`,
      clientTraceId: m.client_trace_id || "",
      role: m.sender_kind === "fellow" ? "assistant" : (m.sender_kind === "system" ? "system" : "user"),
      bodyMd: String(m.body_md || ""),
      trace: m.trace_json ? safeParse(m.trace_json) : null,
      isOwn, isPending: false, createdAt: m.created_at || ""
    };
  }
  function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }

  function renderChat() {} // Task 11 实现
```

- [ ] **Step 2: 浏览器手验(见 Task 14 之后回归);此处仅提交**

```bash
git add src/mobile/app.js
git commit -m "feat(mobile): conversation list render + open conversation"
```

---

## Task 11: app.js — 聊天渲染(气泡 + trace)+ 乐观发送 + WS 实时

**Files:**
- Modify: `src/mobile/app.js`

- [ ] **Step 1: 替换 `renderChat`、`startEvents` 占位,新增发送逻辑**

替换 `function renderChat() {}`:

```js
  function renderChat() {
    const id = state.activeConversationId;
    const list = state.messagesByConv[id] || [];
    const box = $("chatMessages");
    box.innerHTML = "";
    list.forEach((m) => {
      const div = document.createElement("div");
      div.className = `msg ${m.isOwn ? "own" : ""} ${m.isPending ? "pending" : ""} ${m.failed ? "failed" : ""}`.trim();
      let html = "";
      if (m.trace && window.miaTraceBlocks) {
        html += window.miaTraceBlocks.renderTraceBlocks({
          reasoning: m.trace.reasoning, tools: m.trace.tools, content: m.bodyMd, expanded: false, scopeKey: m.messageId
        });
      }
      html += `<span class="msg-text">${escapeHtml(m.bodyMd)}</span>`;
      div.innerHTML = html;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
    if (window.miaTraceBlocks?.markRenderedTraceBlocks) window.miaTraceBlocks.markRenderedTraceBlocks(box);
  }

  async function sendCurrent() {
    const id = state.activeConversationId;
    const input = $("composerInput");
    const text = input.value;
    let pending;
    try {
      pending = window.miaOptimisticSend.buildPendingMessage({ text }, { selfId: state.user?.id, members: state.membersByConv[id] });
    } catch { return; } // 空消息忽略
    input.value = "";
    (state.messagesByConv[id] ||= []).push(pending);
    renderChat();
    try {
      const res = await client.api(`/api/conversations/${encodeURIComponent(id)}/messages`, {
        method: "POST",
        body: { body_md: pending.bodyMd, client_trace_id: pending.clientTraceId, mentions: pending.mentions, attachments: pending.attachments }
      });
      const row = res.message || res;
      state.messagesByConv[id] = window.miaOptimisticSend.reconcilePending(state.messagesByConv[id], row);
    } catch {
      const m = (state.messagesByConv[id] || []).find((x) => x.clientTraceId === pending.clientTraceId);
      if (m) m.failed = true;
    }
    renderChat();
  }
```

替换 `function startEvents() {}`:

```js
  function startEvents() {
    client.connectEvents({
      sinceSeq: () => state.lastEventSeq,
      onStatus: (s) => { $("connBar").classList.toggle("hidden", s === "open"); },
      onEvent: handleEvent
    });
  }

  function handleEvent(env) {
    if (Number.isFinite(Number(env.seq)) && Number(env.seq) > state.lastEventSeq) state.lastEventSeq = Number(env.seq);
    const t = env.type || "";
    if (t === "message" || t === "message.created") {
      const row = env.message || env.data || {};
      const cid = row.conversation_id || env.conversation_id;
      if (cid) {
        state.messagesByConv[cid] = window.miaOptimisticSend.reconcilePending(state.messagesByConv[cid] || [], row);
        if (cid === state.activeConversationId) renderChat();
      }
    } else if (t === "approval.request") {
      approvals.onRequest({ conversationId: env.conversation_id, runId: env.run_id || env.runId, preview: approvalPreview(env) });
      renderApprovalSheet();
    } else if (t === "approval.responded") {
      approvals.onResponded(env.run_id || env.runId);
      renderApprovalSheet();
    }
  }

  function approvalPreview(env) {
    return env.preview || env.tool_name || env.payload?.title || "请求执行操作";
  }
```

在 `bindUi()` 末尾追加:

```js
    $("sendBtn").addEventListener("click", sendCurrent);
    $("composerInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendCurrent(); });
```

- [ ] **Step 2: 提交**

```bash
git add src/mobile/app.js
git commit -m "feat(mobile): chat render with trace + optimistic send + live WS updates"
```

---

## Task 12: app.js — 权限底部 sheet

**Files:**
- Modify: `src/mobile/app.js`

- [ ] **Step 1: 新增 renderApprovalSheet + 决策处理**

新增函数:

```js
  function renderApprovalSheet() {
    const active = approvals.active();
    const sheet = $("approvalSheet");
    if (!active) { sheet.classList.add("hidden"); return; }
    $("approvalPreview").textContent = active.preview || "";
    sheet.classList.remove("hidden");
  }

  async function decideApproval(decision) {
    const active = approvals.active();
    if (!active) return;
    const { decisionToHermesChoice } = window.miaAgentPermissions;
    approvals.resolve(active.runId);
    renderApprovalSheet();
    try {
      await client.api(`/api/conversations/${encodeURIComponent(active.conversationId)}/runs/${encodeURIComponent(active.runId)}/approval`, {
        method: "POST",
        body: { decision, choice: decisionToHermesChoice(decision) }
      });
    } catch {
      // run 可能已结束/失效:静默,sheet 已推进到下一条
    }
  }
```

在 `bindUi()` 末尾追加:

```js
    document.querySelectorAll("#approvalSheet [data-decision]").forEach((b) =>
      b.addEventListener("click", () => decideApproval(b.dataset.decision)));
```

- [ ] **Step 2: 提交**

```bash
git add src/mobile/app.js
git commit -m "feat(mobile): permission bottom sheet with allow/deny/always"
```

---

## Task 13: build-mobile-www 拼装脚本

**Files:**
- Create: `scripts/build-mobile-www.js`

把 `src/mobile/*` + 依赖的 `shared/*` + `cloud-conversation-source.js` 复制到 `dist/mobile-www/`,保持 index.html 里引用的相对路径(`./shared/*`, `./message-sources/*`, `./lib/*`)。

- [ ] **Step 1: 写脚本**

```js
#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const out = path.join(root, "dist", "mobile-www");

const SHARED = [
  "conversation-kinds", "message-spec", "contact", "avatar-resolve",
  "unread", "send-pipeline", "agent-permissions", "trace-blocks", "cloud-client"
];

function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 视图层
["index.html", "styles.css", "app.js", "manifest.json"].forEach((f) => {
  const src = path.join(root, "src", "mobile", f);
  if (fs.existsSync(src)) copy(src, path.join(out, f));
});
// lib
for (const f of fs.readdirSync(path.join(root, "src", "mobile", "lib"))) {
  copy(path.join(root, "src", "mobile", "lib", f), path.join(out, "lib", f));
}
// shared
for (const name of SHARED) copy(path.join(root, "src", "shared", `${name}.js`), path.join(out, "shared", `${name}.js`));
// 渲染适配器
copy(
  path.join(root, "src", "renderer", "message-sources", "cloud-conversation-source.js"),
  path.join(out, "message-sources", "cloud-conversation-source.js")
);

console.log(`[build-mobile-www] wrote ${out}`);
```

- [ ] **Step 2: 跑脚本验证产物**

Run: `node scripts/build-mobile-www.js && ls dist/mobile-www dist/mobile-www/shared`
Expected: 列出 index.html/app.js/styles.css/lib/shared/message-sources;shared 下有 9 个 .js

- [ ] **Step 3: 在 package.json scripts 注册**

把 `"mobile:build": "node scripts/build-mobile-www.js",` 加入 `package.json` 的 `scripts`(放在 `"web"` 行附近)。

- [ ] **Step 4: 提交**

```bash
git add scripts/build-mobile-www.js package.json
git commit -m "feat(mobile): build-mobile-www bundles view + shared into dist/mobile-www"
```

---

## Task 14: serve-mobile dev server(浏览器手验)

**Files:**
- Create: `scripts/serve-mobile.js`

照搬 `scripts/serve-web.js` 的静态服务 + `/api` 代理,根目录指向 `dist/mobile-www`。

- [ ] **Step 1: 写脚本**

```js
#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.join(__dirname, "..", "dist", "mobile-www");
const host = process.env.MIA_MOBILE_HOST || "127.0.0.1";
const port = Number(process.env.MIA_MOBILE_PORT || 4180);
const apiTarget = process.env.MIA_MOBILE_API_TARGET || "http://127.0.0.1:4175";

function contentType(p) {
  const e = path.extname(p).toLowerCase();
  return { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8",
    ".json":"application/json; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png" }[e] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  if (String(req.url || "").startsWith("/api/")) {
    const target = new URL(req.url, apiTarget);
    const proxy = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } },
      (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); });
    proxy.on("error", (e) => { res.writeHead(502, { "Content-Type":"application/json" }); res.end(JSON.stringify({ error: e.message })); });
    req.pipe(proxy);
    return;
  }
  const rel = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.normalize(path.join(root, rel === "/" ? "index.html" : rel.replace(/^\/+/, "")));
  if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, "index.html");
  const body = fs.readFileSync(file);
  res.writeHead(200, { "Content-Type": contentType(file), "Content-Length": body.length });
  res.end(body);
});
server.listen(port, host, () => console.log(`[serve-mobile] http://${host}:${port} (api→${apiTarget})`));
```

- [ ] **Step 2: 注册 npm script**

把 `"mobile": "node scripts/build-mobile-www.js && node scripts/serve-mobile.js",` 加入 `package.json` 的 `scripts`。

- [ ] **Step 3: 浏览器手验主链路**

Run: `npm run mobile`(另起一个 cloud:`npm run cloud`),浏览器开 `http://127.0.0.1:4180`
Expected(手验清单):
- 登录页可注册/登录(服务器留空走默认或填本地 cloud)
- 登录后底部三个 Tab 可切换;消息 Tab 显示会话列表
- 点会话进聊天,历史消息可见,fellow 消息上方有 trace 折叠 chip,点开展开
- 输入文字发送:先出现半透明 pending 气泡,随后落定
- 触发一次需要授权的操作 → 底部 sheet 弹出,点「允许」后消失、run 继续

- [ ] **Step 4: 提交**

```bash
git add scripts/serve-mobile.js package.json
git commit -m "feat(mobile): serve-mobile dev server with /api proxy"
```

---

## Task 15: Capacitor 原生壳

**Files:**
- Create: `mobile-app/capacitor.config.json`
- Modify: `package.json`(devDependency + scripts)

注:iOS/Android 原生构建需 Xcode / Android SDK,本环境无法完整验证;本 Task 完成配置与脚手架,真机/模拟器运行作为交付后验证项。

- [ ] **Step 1: 安装 Capacitor CLI/core**

Run: `npm i -D @capacitor/cli @capacitor/core && npm i @capacitor/ios @capacitor/android`
Expected: 写入 package.json 依赖,无报错

- [ ] **Step 2: 写 capacitor.config.json**

```json
{
  "appId": "app.mia.mobile",
  "appName": "Mia",
  "webDir": "dist/mobile-www",
  "server": { "androidScheme": "https", "iosScheme": "https" }
}
```
放在仓库根(Capacitor 默认在根读取);若放 `mobile-app/` 需 `--config` 指定。MVP 放根:`./capacitor.config.json`。

- [ ] **Step 3: 注册 npm scripts**

加入 `package.json` 的 `scripts`:
```
"mobile:www": "node scripts/build-mobile-www.js",
"mobile:add:ios": "npx cap add ios",
"mobile:add:android": "npx cap add android",
"mobile:sync": "node scripts/build-mobile-www.js && npx cap sync"
```

- [ ] **Step 4: 同步验证(无原生 SDK 也能跑的部分)**

Run: `npm run mobile:www && npx cap sync 2>&1 | head -20`
Expected: web 资产被拷贝到原生工程(若尚未 `cap add` 平台,提示需要先 add — 属预期,记录即可)

- [ ] **Step 5: 提交**

```bash
git add capacitor.config.json package.json package-lock.json
git commit -m "feat(mobile): Capacitor shell config (webDir=dist/mobile-www)"
```

- [ ] **Step 6: 交付后验证项(需原生工具链,不在本环境)**

记入 spec / PR 描述:`npm run mobile:add:ios` → Xcode 打开 `ios/` → 真机/模拟器运行,验证三条主链路在原生壳内一致。

---

## Self-Review 记录

- **Spec 覆盖**:聊天(Task 10/11)、权限底部 sheet(Task 4/12)、trace 折叠(Task 11 用 shared/trace-blocks)、cloud-client 唯一网络层(Task 1/2)、回收旧 mobile(Task 6)、build/serve(Task 13/14)、Capacitor 壳(Task 15)。推送、web 迁移、上架——均在 spec「不在范围」内,未建任务,符合。
- **占位扫描**:`app.js` 中 `DEFAULT_API_BASE` 标了 TODO,属部署期配置值(真实域名待定),非逻辑占位;其余无 TODO/TBD。
- **类型一致**:`buildPendingMessage`/`reconcilePending`/`createApprovalQueue`/`createCloudClient`/`buildConversationListItems` 命名在测试与 app.js 调用处一致;`approvals.active()/resolve()/onRequest()/onResponded()` 一致;`client.api()/connectEvents()/stopEvents()` 一致。
- **已知简化(MVP,记录非缺陷)**:未读数暂传 `{}`;`normalizeServerRow` 自实现而非走 `cloud-conversation-source`(后者面向 listMessages 批处理,MVP 直渲染更简单,后续可替换);联系人/我 Tab 为最小实现。
```
