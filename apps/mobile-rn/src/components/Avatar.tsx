import { Image, View, Text, StyleSheet } from "react-native";
import type { AvatarDescriptor } from "../api/types";
import { normalizeAvatarDescriptor } from "../logic/avatar";
import { color, radius, font } from "../theme";

// Swiss:黑色方块 + 白色首字母(锐角小圆角);有头像图则显示图。
// 仍用 normalizeAvatarDescriptor 取 text/image,但统一走黑白(忽略 per-identity 颜色)。
export default function Avatar({ title, avatar, size = 44 }: { title: string; avatar?: AvatarDescriptor; size?: number }) {
  const resolved = normalizeAvatarDescriptor(title, avatar);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: radius.sm }]}>
      {resolved.image ? (
        <Image source={{ uri: resolved.image }} style={{ width: size, height: size, borderRadius: radius.sm }} />
      ) : (
        <Text style={styles.letter}>{resolved.text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: color.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  letter: { color: color.bg, fontFamily: font.display, fontSize: 15, letterSpacing: 0.5 },
});
