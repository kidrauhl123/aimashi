import { View, FlatList, StyleSheet } from "react-native";
import { useFellows, useFriends } from "../state/queries";
import Avatar from "../components/Avatar";
import type { AvatarDescriptor } from "../api/types";
import { resolveAvatar } from "../logic/conversationList";
import { BodyStrong, Label } from "../ui/Text";
import { color, space, hairlineWidth } from "../theme";

interface Row {
  key: string;
  title: string;
  sub: string;
  avatar: AvatarDescriptor;
}

export default function ContactsScreen() {
  const { data: fellows = [] } = useFellows();
  const { data: friends = [] } = useFriends();
  const rows: Row[] = [
    ...friends.map((f, i) => {
      const title = f.username || f.account || String(f.id);
      return { key: `fr:${f.id || i}`, title, sub: "好友", avatar: resolveAvatar(f.id || title, title, f.avatarImage || "", f.avatarCrop || null) };
    }),
    ...fellows.map((f, i) => {
      const id = f.id || f.key || String(i);
      const title = f.name || String(id);
      return { key: `fe:${id}`, title, sub: "FELLOW", avatar: resolveAvatar(id, title, f.avatarImage || "", f.avatarCrop || null) };
    }),
  ];
  return (
    <FlatList
      style={styles.root}
      data={rows}
      keyExtractor={(r) => r.key}
      ListEmptyComponent={<Label style={styles.empty}>暂无联系人</Label>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar title={item.title} avatar={item.avatar} />
          <View style={styles.col}>
            <BodyStrong>{item.title}</BodyStrong>
            <Label style={styles.sub}>{item.sub}</Label>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  empty: { textAlign: "center", marginTop: 48 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: color.hairline,
  },
  col: { flex: 1, gap: 3 },
  sub: { color: color.accent },
});
