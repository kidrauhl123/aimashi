import { createApprovalQueue } from "../src/logic/approvalQueue";

test("入队 FIFO,active 最早", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1", preview: "rm" });
  q.onRequest({ conversationId: "c1", runId: "r2", preview: "ls" });
  expect(q.active()!.runId).toBe("r1");
  expect(q.size()).toBe(2);
});

test("resolve 前进", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1" });
  q.onRequest({ conversationId: "c1", runId: "r2" });
  q.resolve("r1");
  expect(q.active()!.runId).toBe("r2");
});

test("responded 移除", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1" });
  q.onResponded("r1");
  expect(q.active()).toBeNull();
  expect(q.size()).toBe(0);
});

test("同 runId 去重", () => {
  const q = createApprovalQueue();
  q.onRequest({ conversationId: "c1", runId: "r1", preview: "a" });
  q.onRequest({ conversationId: "c1", runId: "r1", preview: "a" });
  expect(q.size()).toBe(1);
});
