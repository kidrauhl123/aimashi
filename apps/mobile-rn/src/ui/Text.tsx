import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { type } from "../theme";

// 文字预设(全系统字体,对齐桌面端)。
export function Brand(p: TextProps) {
  return <RNText {...p} style={[styles.brand, p.style]} />;
}
export function Title(p: TextProps) {
  return <RNText {...p} style={[styles.title, p.style]} />;
}
export function Body(p: TextProps) {
  return <RNText {...p} style={[styles.body, p.style]} />;
}
export function BodyStrong(p: TextProps) {
  return <RNText {...p} style={[styles.bodyStrong, p.style]} />;
}
export function Sub(p: TextProps) {
  return <RNText {...p} style={[styles.sub, p.style]} />;
}
export function Label(p: TextProps) {
  return <RNText {...p} style={[styles.label, p.style]} />;
}

const styles = StyleSheet.create({
  brand: type.brand,
  title: type.title,
  body: type.body,
  bodyStrong: type.bodyStrong,
  sub: type.sub,
  label: type.label,
});
