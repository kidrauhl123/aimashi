import { View, Text, StyleSheet } from "react-native";
import { color, space } from "../theme";
import { useEvents } from "../state/events";

// 连接异常时顶部一条柔和提示带(对齐桌面 warn 配色)。
export default function ConnBanner() {
  const { connStatus } = useEvents();
  if (connStatus === "open") return null;
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>连接中…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: color.warnBg, paddingVertical: space.xs },
  text: { color: color.warn, textAlign: "center", fontSize: 13 },
});
