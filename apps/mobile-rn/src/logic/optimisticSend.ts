// 移植自 src/mobile/lib/optimistic-send.js,依赖 sendPipeline。
import { prepareOutgoingMessage } from "./sendPipeline";
import type { ChatMessage, MessageRow, Member } from "../api/types";

export function buildPendingMessage(
  input: { text?: string; attachments?: unknown[]; replyTo?: unknown },
  ctx: { selfId?: string; members?: Member[] }
): ChatMessage & { attachments: unknown[]; mentions: string[] } {
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
    createdAt: "",
  };
}

// 命中 clientTraceId 则替换 pending,否则追加。
export function reconcilePending(list: ChatMessage[], serverRow: MessageRow & { clientTraceId?: string }): ChatMessage[] {
  const trace = serverRow.client_trace_id || serverRow.clientTraceId || "";
  const next = Array.isArray(list) ? list.slice() : [];
  const idx = trace ? next.findIndex((m) => m.clientTraceId && m.clientTraceId === trace) : -1;
  const merged: ChatMessage = {
    messageId: serverRow.id || (trace ? `pending:${trace}` : ""),
    clientTraceId: trace,
    bodyMd: String(serverRow.body_md || ""),
    role: "user",
    isOwn: true,
    isPending: false,
    createdAt: serverRow.created_at || "",
  };
  if (idx >= 0) next[idx] = { ...next[idx], ...merged };
  else next.push(merged);
  return next;
}
