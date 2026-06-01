import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { color, radius, space, font } from "../theme";

type Variant = "primary" | "outline" | "ghost" | "danger";

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}

// Swiss 按钮:锐利小圆角、粗体大写、信号橙 primary、黑描边 outline。
export default function Button({ label, onPress, variant = "primary", disabled, busy, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "outline" && styles.outline,
        variant === "ghost" && styles.ghost,
        variant === "danger" && styles.danger,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "primary" ? color.accentText : color.ink} />
      ) : (
        <Text style={[styles.label, variant === "primary" ? styles.labelOnAccent : styles.labelInk]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  primary: { backgroundColor: color.accent },
  outline: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.rule },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: color.danger },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  label: { fontFamily: font.display, fontSize: 14, letterSpacing: 0.8, textTransform: "uppercase" },
  labelOnAccent: { color: color.accentText },
  labelInk: { color: color.ink },
});
