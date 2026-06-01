import { Image, View, Text, StyleSheet } from "react-native";
import type { AvatarDescriptor } from "../api/types";
import { theme } from "../theme";

export default function Avatar({ title, avatar, size = 42 }: { title: string; avatar?: AvatarDescriptor; size?: number }) {
  const text = avatar?.text || Array.from(String(title || "?").trim()).slice(0, 2).join("") || "?";
  const image = String(avatar?.image || "").trim();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar?.color || theme.accent }]}>
      {image ? <Image source={{ uri: image }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} /> : <Text style={styles.letter}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { resizeMode: "cover" },
  letter: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
