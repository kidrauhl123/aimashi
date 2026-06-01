import { View, Text, StyleSheet } from "react-native";
import { color, font, space } from "../theme";
import { useEvents } from "../state/events";

// Swiss:连接异常时顶部一条信号橙细带。
export default function ConnBanner() {
  const { connStatus } = useEvents();
  if (connStatus === "open") return null;
  return (
    <View style={styles.bar}>
      <Text style={styles.text}>● 连接中</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: color.accent, paddingVertical: space.xs },
  text: { color: color.accentText, textAlign: "center", fontSize: 11, fontFamily: font.semibold, letterSpacing: 0.5 },
});
