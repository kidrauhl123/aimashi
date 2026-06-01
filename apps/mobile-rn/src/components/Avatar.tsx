import { Image, View, Text, StyleSheet } from "react-native";
import type { AvatarDescriptor } from "../api/types";
import { normalizeAvatarDescriptor } from "../logic/avatar";

// 对齐桌面:圆形头像 + 身份哈希底色 + 白色首字母;有图则显示图。
export default function Avatar({ title, avatar, size = 44 }: { title: string; avatar?: AvatarDescriptor; size?: number }) {
  const resolved = normalizeAvatarDescriptor(title, avatar);
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 2, backgroundColor: resolved.color }]}>
      {resolved.image ? (
        <Image source={{ uri: resolved.image }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{resolved.text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  letter: { color: "#fff", fontWeight: "600" },
});
