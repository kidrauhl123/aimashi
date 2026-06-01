// 移植自 src/mobile/lib/conversation-list-model.js
import type { AvatarDescriptor, Conversation } from "../api/types";

export interface ConversationListItem {
  id: string;
  title: string;
  subtitle: string;
  unread: number;
  avatar: AvatarDescriptor;
  raw: Conversation;
}

const PALETTE = ["#e17076", "#f0a574", "#b08fd8", "#7bc862", "#65aadd", "#ee7aae", "#6ec9cb"];

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function memberAccentColor(id: string): string {
  const key = String(id || "").trim();
  if (!key) return PALETTE[0];
  return PALETTE[hashCode(key) % PALETTE.length];
}

export function identityDisplayText(displayName: string, fallback = "?"): string {
  return Array.from(String(displayName || fallback || "").trim()).slice(0, 2).join("") || "?";
}

export function resolveAvatar(id: string, displayName: string, image = "", crop: Record<string, unknown> | null = null): AvatarDescriptor {
  const avatarImage = String(image || "").trim();
  return {
    image: avatarImage,
    crop: avatarImage ? crop : null,
    color: memberAccentColor(id),
    text: identityDisplayText(displayName, id),
  };
}

function activityTime(c: Conversation): number {
  const t = c.last_activity_at || c.updated_at || c.created_at || "";
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : 0;
}

export function buildConversationListItems(deps: {
  conversations: Conversation[];
  unreadByConversation?: Record<string, number>;
}): ConversationListItem[] {
  const convs = Array.isArray(deps.conversations) ? deps.conversations.slice() : [];
  const unread = deps.unreadByConversation || {};
  convs.sort((a, b) => activityTime(b) - activityTime(a));
  return convs.map((c) => {
    const title = c.name || c.title || c.id;
    return {
      id: c.id,
      title,
      subtitle: String(c.last_message_text || ""),
      unread: Number(unread[c.id]) || 0,
      avatar: c.identity?.avatar || resolveAvatar(c.id, title),
      raw: c,
    };
  });
}
