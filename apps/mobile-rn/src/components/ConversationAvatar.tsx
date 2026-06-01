import { Image, View, Text, StyleSheet } from "react-native";
import type { AvatarDescriptor } from "../api/types";

// 单 tile:圆形彩色 + 白首字母或图。
function Tile({ tile, size, radius, font }: { tile: AvatarDescriptor; size: number; radius: number; font: number }) {
  const image = String(tile.image || "").trim();
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius, backgroundColor: tile.color || "#5e5ce6" }]}>
      {image ? (
        <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: radius }} />
      ) : (
        <Text style={[styles.letter, { fontSize: font }]}>{tile.text}</Text>
      )}
    </View>
  );
}

// 会话头像:1 个 = 单圆;2~4 个 = 圆形容器内成员拼贴(对齐桌面 group-avatar mosaic)。
export default function ConversationAvatar({ tiles, size = 44 }: { tiles: AvatarDescriptor[]; size?: number }) {
  const list = (tiles && tiles.length ? tiles : [{ image: "", crop: null, color: "#5e5ce6", text: "?" }]).slice(0, 4);
  if (list.length === 1) {
    return <Tile tile={list[0]} size={size} radius={size / 2} font={size * 0.4} />;
  }
  const half = size / 2;
  const f = size * 0.22;
  return (
    <View style={[styles.mosaic, { width: size, height: size, borderRadius: size / 2 }]}>
      {list.length === 2 ? (
        <>
          <Tile tile={list[0]} size={half} radius={0} font={f} />
          <Tile tile={list[1]} size={half} radius={0} font={f} />
        </>
      ) : list.length === 3 ? (
        <>
          <Tile tile={list[0]} size={half} radius={0} font={f} />
          <View>
            <Tile tile={list[1]} size={half} radius={0} font={f} />
            <Tile tile={list[2]} size={half} radius={0} font={f} />
          </View>
        </>
      ) : (
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <Tile tile={list[0]} size={half} radius={0} font={f} />
            <Tile tile={list[1]} size={half} radius={0} font={f} />
          </View>
          <View style={styles.gridRow}>
            <Tile tile={list[2]} size={half} radius={0} font={f} />
            <Tile tile={list[3]} size={half} radius={0} font={f} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  letter: { color: "#fff", fontWeight: "600" },
  mosaic: { flexDirection: "row", overflow: "hidden", backgroundColor: "#fff" },
  grid: { flexDirection: "column" },
  gridRow: { flexDirection: "row" },
});
