import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { color, font, radius, space } from "../theme";

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

// Swiss:小号大写标签 chip,点开展开 reasoning + 工具(等宽)。
export default function TraceBlock({ trace }: Props) {
  const [open, setOpen] = useState(false);
  if (!trace || (!trace.reasoning && !trace.tools)) return null;
  const tools = Array.isArray(trace.tools) ? trace.tools : trace.tools ? [trace.tools] : [];
  const steps = (trace.reasoning ? 1 : 0) + tools.length;
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={6} style={styles.chip}>
        <Text style={styles.chipText}>{open ? "▾ TRACE" : `▸ TRACE · ${steps}`}</Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          {trace.reasoning ? <Text style={styles.reason}>{toText(trace.reasoning)}</Text> : null}
          {tools.map((t: any, i: number) => (
            <Text key={i} style={styles.tool}>
              → {toText(t.name || t.tool || t)}
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
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  chipText: { fontFamily: font.semibold, fontSize: 10, letterSpacing: 1, color: color.ink },
  body: { marginTop: space.sm, paddingLeft: space.sm, borderLeftWidth: 2, borderLeftColor: color.accent },
  reason: { fontFamily: "Courier", fontSize: 12, color: color.inkMuted, marginBottom: space.xs },
  tool: { fontFamily: "Courier", fontSize: 12, color: color.inkMuted },
});
