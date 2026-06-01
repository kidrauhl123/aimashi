import { View, FlatList, Pressable, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useConversations, useFellows } from "../state/queries";
import { buildConversationListItems } from "../logic/conversationList";
import Avatar from "../components/Avatar";
import ConnBanner from "../components/ConnBanner";
import { BodyStrong, Sub } from "../ui/Text";
import { color, space, hairlineWidth } from "../theme";
import type { MessagesStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<MessagesStackParamList, "Conversations">;

export default function ConversationListScreen({ navigation }: Props) {
  const { data: conversations = [], isLoading, refetch, isRefetching } = useConversations();
  const { data: fellows = [] } = useFellows();
  const items = buildConversationListItems({ conversations, fellows, unreadByConversation: {} });

  return (
    <View style={styles.root}>
      <ConnBanner />
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={<Sub style={styles.empty}>{isLoading ? "加载中…" : "还没有会话"}</Sub>}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => navigation.navigate("Chat", { conversationId: item.id, title: item.title })}
          >
            <Avatar title={item.title} avatar={item.avatar} />
            <View style={styles.textCol}>
              <BodyStrong numberOfLines={1}>{item.title}</BodyStrong>
              <Sub numberOfLines={1} style={styles.sub}>{item.subtitle}</Sub>
            </View>
            {item.unread ? (
              <View style={styles.badge}>
                <Sub style={styles.badgeText}>{item.unread}</Sub>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
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
    borderBottomColor: color.line,
    backgroundColor: color.bg,
  },
  pressed: { backgroundColor: color.surfaceMuted },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  sub: { marginTop: 1 },
  badge: { backgroundColor: color.accent, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeText: { color: color.accentText, fontSize: 12, fontWeight: "600" },
});
