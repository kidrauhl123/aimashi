import { TextInput, TextInputProps, StyleSheet } from "react-native";
import { color, radius, space } from "../theme";

// Swiss 输入框:浅灰填充、细黑下划线焦点感由黑描边表达,锐利小圆角。
export default function Input(props: TextInputProps) {
  return <TextInput {...props} placeholderTextColor={color.inkFaint} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.hairline,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 15,
    color: color.ink,
  },
});
