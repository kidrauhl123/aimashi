// 移植自 src/shared/send-pipeline.js 的 prepareOutgoingMessage / parseMentions。
import type { Member } from "../api/types";

const DEFAULT_MAX_LENGTH = 8000;

export interface OutgoingInput {
  text?: string;
  attachments?: unknown[];
  replyTo?: unknown;
}
export interface OutgoingCtx {
  members?: Member[];
  maxLength?: number;
}
export interface PreparedMessage {
  bodyMd: string;
  mentions: string[];
  attachments: unknown[];
  clientTraceId: string;
  replyTo?: unknown;
}

export function generateClientTraceId(): string {
  return `ct_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// 解析正文里的 @token,匹配会话 fellow 成员 → 返回 member_ref 列表。
export function parseMentions(text: string, members?: Member[]): string[] {
  if (!text || !Array.isArray(members) || !members.length) return [];
  const out: string[] = [];
  const re = /(^|\s)@([A-Za-z0-9_\-.:]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const token = m[2];
    const hit = members.find((mem) => mem.member_kind === "fellow" && mem.member_ref === token);
    if (hit && hit.member_ref && !out.includes(hit.member_ref)) out.push(hit.member_ref);
  }
  return out;
}

export function prepareOutgoingMessage(rawInput: OutgoingInput, ctx: OutgoingCtx = {}): PreparedMessage {
  const input = rawInput || {};
  const rawText = typeof input.text === "string" ? input.text : "";
  const bodyMd = rawText.trim();
  const attachments = Array.isArray(input.attachments) ? input.attachments.slice() : [];

  if (!bodyMd && !attachments.length) {
    const err: any = new Error("send-pipeline: empty message (no text and no attachments)");
    err.code = "EMPTY_MESSAGE";
    throw err;
  }
  const maxLength = typeof ctx.maxLength === "number" && ctx.maxLength > 0 ? ctx.maxLength : DEFAULT_MAX_LENGTH;
  if (bodyMd.length > maxLength) {
    const err: any = new Error(`send-pipeline: message exceeds ${maxLength} chars (got ${bodyMd.length})`);
    err.code = "MESSAGE_TOO_LONG";
    throw err;
  }
  const mentions = bodyMd ? parseMentions(bodyMd, ctx.members) : [];
  const result: PreparedMessage = { bodyMd, mentions, attachments, clientTraceId: generateClientTraceId() };
  if (input.replyTo) result.replyTo = input.replyTo;
  return result;
}
