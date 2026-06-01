// 移植自 src/mobile/lib/conversation-list-model.js
import type { Conversation } from "../api/types";

export interface ConversationListItem {
  id: string;
  title: string;
  subtitle: string;
  unread: number;
  raw: Conversation;
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
  return convs.map((c) => ({
    id: c.id,
    title: c.name || c.title || c.id,
    subtitle: String(c.last_message_text || ""),
    unread: Number(unread[c.id]) || 0,
    raw: c,
  }));
}
