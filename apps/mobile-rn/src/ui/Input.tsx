import { TextInput, TextInputProps, StyleSheet } from "react-native";
import { color, radius, space } from "../theme";

// 输入框对齐桌面:白底、1px 淡边线、圆角 12。
export default function Input(props: TextInputProps) {
  return <TextInput {...props} placeholderTextColor={color.inkFaint} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 15,
    color: color.ink,
  },
});
