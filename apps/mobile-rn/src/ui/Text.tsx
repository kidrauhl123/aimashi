import { Text as RNText, TextProps, StyleSheet } from "react-native";
import { type } from "../theme";

// Swiss 文字预设。中文用系统体(由系统字体渲染),拉丁/品牌经 Archivo 注入腔调。
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
  return <RNText {...p} numberOfLines={p.numberOfLines} style={[styles.sub, p.style]} />;
}
// 小号大写标签;children 会被转大写显示(仅对拉丁有效)
export function Label(p: TextProps) {
  return <RNText {...p} style={[styles.label, p.style]} />;
}

const styles = StyleSheet.create({
  brand: type.brand,
  title: type.title,
  body: type.body,
  bodyStrong: type.bodyStrong,
  sub: type.sub,
  label: { ...type.label, textTransform: "uppercase" },
});
