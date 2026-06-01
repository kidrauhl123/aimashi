// 移植自 src/shared/contact.js —— self / fellow / user 统一解析为可渲染 avatar。
import type { AvatarDescriptor, Fellow, Friend } from "../api/types";
import { resolveAvatarForContact } from "./avatar";

export const ContactKind = { Self: "self", Fellow: "fellow", User: "user" } as const;
export type ContactKindT = (typeof ContactKind)[keyof typeof ContactKind];

export interface SelfRecord {
  id?: string;
  username?: string;
  account?: string;
  displayName?: string;
  avatarImage?: string;
  avatarCrop?: Record<string, unknown> | null;
}

export interface ResolveCtx {
  self?: SelfRecord;
  fellows?: Fellow[];
  friends?: Friend[];
}

function avatarForRecord(id: string, record: any = {}, displayName = ""): AvatarDescriptor {
  return resolveAvatarForContact({
    id: String(id || ""),
    displayName: displayName || record.displayName || record.name || record.username || record.account || "",
    avatarImage: record.avatarImage || "",
    avatarCrop: record.avatarCrop || null,
  });
}

export interface ResolvedContact {
  kind: string;
  id: string;
  displayName: string;
  avatar: AvatarDescriptor;
}

export function resolveContact(query: { kind: ContactKindT; ref?: string }, ctx: ResolveCtx = {}): ResolvedContact {
  const { kind, ref } = query || ({} as any);
  if (kind === ContactKind.Self) {
    const u = ctx.self || {};
    const displayName = u.displayName || u.username || u.account || "";
    return { kind: ContactKind.Self, id: u.id || "", displayName, avatar: avatarForRecord(u.id || "", u, displayName) };
  }
  if (kind === ContactKind.Fellow) {
    const f = (ctx.fellows || []).find((x) => x.key === ref || x.id === ref);
    const id = String((f && (f.key || f.id)) || ref || "");
    const displayName = (f && (f.name || f.key)) || String(ref || "");
    return { kind: ContactKind.Fellow, id, displayName, avatar: avatarForRecord(id, f || {}, displayName) };
  }
  if (kind === ContactKind.User) {
    if (ctx.self && ctx.self.id === ref) return resolveContact({ kind: ContactKind.Self }, ctx);
    const f = (ctx.friends || []).find((x) => x.id === ref);
    const id = String((f && f.id) || ref || "");
    const displayName = (f && (f.username || f.account || f.id)) || String(ref || "");
    return { kind: ContactKind.User, id, displayName, avatar: avatarForRecord(id, f || {}, displayName) };
  }
  return { kind: "", id: "", displayName: "", avatar: avatarForRecord("", {}) };
}
