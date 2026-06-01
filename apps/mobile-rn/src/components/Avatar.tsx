import { Image, View, Text, StyleSheet } from "react-native";
import type { AvatarDescriptor } from "../api/types";
import { normalizeAvatarDescriptor } from "../logic/avatar";

export default function Avatar({ title, avatar, size = 42 }: { title: string; avatar?: AvatarDescriptor; size?: number }) {
  const resolved = normalizeAvatarDescriptor(title, avatar);
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: resolved.color }]}>
      {resolved.image ? <Image source={{ uri: resolved.image }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} /> : <Text style={styles.letter}>{resolved.text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { resizeMode: "cover" },
  letter: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
