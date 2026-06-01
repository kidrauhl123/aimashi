import type { AvatarDescriptor, Conversation } from "../api/types";
import { normalizeAvatarDescriptor, resolveAvatar } from "./avatar";

export interface ConversationListItem {
  id: string;
  title: string;
  subtitle: string;
  unread: number;
  avatar: AvatarDescriptor;
  raw: Conversation;
}

export { identityDisplayText, memberAccentColor, resolveAvatar } from "./avatar";

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
    const identityAvatar = c.identity?.avatar ? normalizeAvatarDescriptor(title, c.identity.avatar) : null;
    return {
      id: c.id,
      title,
      subtitle: String(c.last_message_text || ""),
      unread: Number(unread[c.id]) || 0,
      avatar: identityAvatar || resolveAvatar(c.id, title),
      raw: c,
    };
  });
}
