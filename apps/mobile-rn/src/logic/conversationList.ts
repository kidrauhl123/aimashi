import type { AvatarDescriptor, Conversation, Fellow } from "../api/types";
import { normalizeAvatarDescriptor, resolveAvatar, resolveAvatarForContact } from "./avatar";
import { sidebarConversations, conversationListTitle, conversationType, fellowKey } from "./sessionHistory";

// 与桌面 fellowAvatarFor 一致:fellow 行的头像从 fellow 档案解析
// (真实 avatarImage + 按 fellow 身份哈希取色 + 两字符回退)。
function fellowAvatarFor(c: Conversation, fellows: Fellow[]): AvatarDescriptor {
  const key = fellowKey(c);
  const fellow = fellows.find((f) => String(f.key || f.id || "") === key);
  return resolveAvatarForContact({
    id: fellow?.id || fellow?.key || key,
    displayName: fellow?.name || c.name || key,
    avatarImage: fellow?.avatarImage || "",
    avatarCrop: fellow?.avatarCrop || null,
  });
}

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

// 桌面/web 一致:fellow 会话按主体折叠成一张卡(每个 fellow 一个代表 session),
// DM/群各自一张;fellow 卡标题取 fellow 名、头像按 fellowKey 稳定取色。
export function buildConversationListItems(deps: {
  conversations: Conversation[];
  fellows?: Fellow[];
  unreadByConversation?: Record<string, number>;
  activeConversationId?: string;
}): ConversationListItem[] {
  const fellows = deps.fellows || [];
  const unread = deps.unreadByConversation || {};
  const aggregated = sidebarConversations(deps.conversations || [], {
    activeConversationId: deps.activeConversationId,
  });
  aggregated.sort((a, b) => activityTime(b) - activityTime(a));
  return aggregated.map((c) => {
    const title = conversationListTitle(c, fellows);
    let avatar: AvatarDescriptor;
    if (conversationType(c) === "fellow") {
      avatar = fellowAvatarFor(c, fellows); // 同桌面:从 fellow 档案取真实头像
    } else if (c.identity?.avatar) {
      avatar = normalizeAvatarDescriptor(title, c.identity.avatar); // 服务端已解析(DM/群)
    } else {
      avatar = resolveAvatar(c.id, title);
    }
    return {
      id: c.id,
      title,
      subtitle: String(c.last_message_text || ""),
      unread: Number(unread[c.id]) || 0,
      avatar,
      raw: c,
    };
  });
}
