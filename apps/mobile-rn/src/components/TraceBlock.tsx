import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { color, radius, space } from "../theme";

interface Props {
  trace: { reasoning?: any; tools?: any } | null | undefined;
}

function toText(v: any): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

// 软风格折叠 chip:浅灰圆角、muted 文字,点开看 reasoning + 工具。
export default function TraceBlock({ trace }: Props) {
  const [open, setOpen] = useState(false);
  if (!trace || (!trace.reasoning && !trace.tools)) return null;
  const tools = Array.isArray(trace.tools) ? trace.tools : trace.tools ? [trace.tools] : [];
  const steps = (trace.reasoning ? 1 : 0) + tools.length;
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={styles.chip}>
        <Text style={styles.chipText}>{open ? "▾ 思考过程" : `▸ 思考 · ${steps} 步`}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {trace.reasoning ? <Text style={styles.reason}>{toText(trace.reasoning)}</Text> : null}
          {tools.map((t: any, i: number) => (
            <Text key={i} style={styles.tool}>
              🔧 {toText(t.name || t.tool || t)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.sm },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: { fontSize: 12, color: color.inkMuted },
  body: { marginTop: space.sm, paddingLeft: space.sm, borderLeftWidth: 2, borderLeftColor: color.line },
  reason: { fontSize: 13, color: color.inkMuted, marginBottom: space.xs, lineHeight: 19 },
  tool: { fontSize: 12, color: color.inkFaint },
});
