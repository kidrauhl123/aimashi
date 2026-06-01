import { View, Text, FlatList, StyleSheet } from "react-native";
import { useFellows, useFriends } from "../state/queries";
import Avatar from "../components/Avatar";
import type { AvatarDescriptor } from "../api/types";
import { resolveAvatar } from "../logic/conversationList";
import { theme } from "../theme";

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
      return { key: `fe:${id}`, title, sub: "Fellow", avatar: resolveAvatar(id, title, f.avatarImage || "", f.avatarCrop || null) };
    }),
  ];
  return (
    <FlatList
      style={styles.root}
      data={rows}
      keyExtractor={(r) => r.key}
      ListEmptyComponent={<Text style={styles.empty}>暂无联系人</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar title={item.title} avatar={item.avatar} />
          <View style={styles.col}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  empty: { textAlign: "center", color: theme.muted, marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.line, backgroundColor: theme.card },
  col: { flex: 1 },
  title: { fontWeight: "600", color: theme.text },
  sub: { color: theme.muted, fontSize: 13 },
});
