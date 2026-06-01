import { View, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { color, radius, space } from "../theme";
import TraceBlock from "./TraceBlock";
import type { ChatMessage } from "../api/types";

// Swiss:自己 = 信号橙底白字、锐角;对方 = 白卡 + 1px 黑描边。
export default function MessageBubble({ msg }: { msg: ChatMessage }) {
  const own = msg.isOwn;
  const textColor = own ? color.accentText : color.ink;
  return (
    <View
      style={[
        styles.bubble,
        own ? styles.own : styles.other,
        msg.isPending ? styles.pending : null,
        msg.failed ? styles.failed : null,
      ]}
    >
      {!own && msg.trace ? <TraceBlock trace={msg.trace} /> : null}
      <Markdown
        style={{
          body: { color: textColor, margin: 0, fontSize: 15, lineHeight: 21 },
          code_inline: { backgroundColor: own ? "rgba(255,255,255,0.2)" : color.surfaceAlt, color: textColor },
          fence: { backgroundColor: own ? "rgba(255,255,255,0.18)" : color.surfaceAlt, color: textColor, borderWidth: 0 },
        }}
      >
        {msg.bodyMd || ""}
      </Markdown>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "84%", paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, marginVertical: 3 },
  own: { alignSelf: "flex-end", backgroundColor: color.accent, borderTopRightRadius: radius.none },
  other: { alignSelf: "flex-start", backgroundColor: color.surface, borderWidth: 1, borderColor: color.rule, borderTopLeftRadius: radius.none },
  pending: { opacity: 0.5 },
  failed: { borderWidth: 1.5, borderColor: color.danger },
});
