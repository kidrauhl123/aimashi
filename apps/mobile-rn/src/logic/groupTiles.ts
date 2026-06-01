// 移植自 src/shared/group-tiles.js —— 群头像成员拼贴的 tile 列表。
import type { AvatarDescriptor, Member, Fellow, Friend } from "../api/types";
import { resolveAvatarForContact } from "./avatar";
import type { SelfRecord } from "./contact";

function hasAvatarIdentityFields(record: any): boolean {
  return Boolean(
    record &&
      typeof record === "object" &&
      ("avatarImage" in record || "avatarCrop" in record || "avatar_image" in record || "avatar_crop" in record)
  );
}

interface MemberRow extends Member {
  member_kind?: string;
  member_ref?: string;
  owner_id?: string;
  fellow_name?: string;
  fellow_avatar_image?: string;
  fellow_avatar_crop?: Record<string, unknown> | null;
  identity?: { avatar?: { image?: string; crop?: any }; displayName?: string };
}

export interface GroupTileCtx {
  self?: SelfRecord;
  friends?: Friend[];
  fellows?: Fellow[];
}

export function resolveGroupMemberTiles(members: MemberRow[], ctx: GroupTileCtx = {}): AvatarDescriptor[] {
  if (!Array.isArray(members)) return [];
  const { self, friends, fellows } = ctx;
  const out: AvatarDescriptor[] = [];
  for (const m of members) {
    if (!m) continue;
    const kind = m.member_kind;
    const ref = String(m.member_ref || "");
    const identityAvatar = m.identity?.avatar || {};
    if (kind === "user") {
      if (self && ref === self.id) {
        const hasSelf = hasAvatarIdentityFields(self);
        out.push(
          resolveAvatarForContact({
            id: self.id,
            displayName: self.displayName || self.username || self.account || m.identity?.displayName || self.id,
            avatarImage: hasSelf ? self.avatarImage : identityAvatar.image,
            avatarCrop: (hasSelf ? self.avatarCrop : identityAvatar.crop) || null,
          })
        );
        continue;
      }
      const friend: any = (friends || []).find((f) => f.id === ref);
      const hasFriendAvatar = hasAvatarIdentityFields(friend);
      out.push(
        resolveAvatarForContact({
          id: ref,
          displayName: friend?.username || friend?.account || m.identity?.displayName || ref,
          avatarImage: friend && hasFriendAvatar ? friend.avatarImage : identityAvatar.image,
          avatarCrop: (friend && hasFriendAvatar ? friend.avatarCrop : identityAvatar.crop) || null,
        })
      );
      continue;
    }
    if (kind === "fellow") {
      const fellow: any = (fellows || []).find((f) => (f.id || f.key) === ref);
      const hasFellowAvatar = hasAvatarIdentityFields(fellow);
      out.push(
        resolveAvatarForContact({
          id: ref,
          displayName: fellow?.name || m.identity?.displayName || m.fellow_name || ref,
          avatarImage: fellow && hasFellowAvatar ? fellow.avatarImage : identityAvatar.image || m.fellow_avatar_image,
          avatarCrop: (fellow && hasFellowAvatar ? fellow.avatarCrop : identityAvatar.crop || m.fellow_avatar_crop) || null,
        })
      );
      continue;
    }
  }
  return out;
}
