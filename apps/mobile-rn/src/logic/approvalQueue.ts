// 移植自 src/mobile/lib/approval-queue.js
export interface ApprovalItem {
  conversationId: string;
  runId: string;
  preview: string;
}

export function createApprovalQueue() {
  let items: ApprovalItem[] = [];
  function remove(runId: string) {
    items = items.filter((it) => it.runId !== runId);
  }
  return {
    onRequest(req: Partial<ApprovalItem>) {
      if (!req || !req.runId) return;
      if (items.some((it) => it.runId === req.runId)) return;
      items.push({ conversationId: req.conversationId || "", runId: req.runId, preview: req.preview || "" });
    },
    onResponded(runId: string) {
      remove(runId);
    },
    resolve(runId: string) {
      remove(runId);
    },
    active(): ApprovalItem | null {
      return items.length ? items[0] : null;
    },
    size(): number {
      return items.length;
    },
  };
}

export type ApprovalQueue = ReturnType<typeof createApprovalQueue>;
