// 设计系统:对齐桌面端 / web(src/renderer/styles.css :root)。
// 柔和浅色 Apple 风:系统字体、靛蓝强调色、浅灰/靛蓝气泡、圆形头像、柔和阴影。

export const color = {
  bg: "#FFFFFF", // 列表/设置等白底
  chatBg: "#F0F0F3", // 聊天区背景(--chat-background)
  surface: "#FFFFFF",
  surfaceMuted: "#F5F5F8", // --surface-muted
  field: "rgba(0,0,0,0.06)", // --field
  ink: "rgba(0,0,0,0.92)", // --text
  inkMuted: "rgba(0,0,0,0.60)", // --muted
  inkFaint: "rgba(0,0,0,0.36)", // --faint
  line: "rgba(0,0,0,0.08)", // --line
  lineStrong: "rgba(0,0,0,0.14)", // --line-strong
  accent: "#5E5CE6", // --accent
  accentSoft: "rgba(94,92,230,0.16)", // --active
  accentText: "#FFFFFF",
  accent2: "#30D158", // --accent-2
  bubbleOther: "rgba(0,0,0,0.055)", // 对方气泡浅灰
  userBubble: "#5E5CE6", // 自己气泡(对齐 web:accent 底白字)
  userBubbleText: "#FFFFFF",
  danger: "#D14343",
  warn: "#9A5A00",
  warnBg: "#FFF6DF",
  codeBg: "#22242D",
  codeText: "#EEF0F6",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 14, bubble: 18, pill: 999 };
export const hairlineWidth = 1;

// 柔和阴影(--shadow)。RN 用对象形式。
export const shadow = {
  shadowColor: "#141828",
  shadowOpacity: 0.08,
  shadowRadius: 17,
  shadowOffset: { width: 0, height: 14 },
  elevation: 4,
};

// 字体:全系统体(iOS PingFang / Android Roboto-Noto,中英文一致渲染)。
// 桌面端也是系统字体,不引自定义字体。粗细靠 fontWeight。
export const type = {
  brand: { fontSize: 24, fontWeight: "800" as const, letterSpacing: 0.2, color: color.ink },
  title: { fontSize: 17, fontWeight: "700" as const, color: color.ink },
  body: { fontSize: 15, lineHeight: 23, color: color.ink },
  bodyStrong: { fontSize: 15, lineHeight: 23, fontWeight: "600" as const, color: color.ink },
  sub: { fontSize: 13, color: color.inkMuted },
  label: { fontSize: 12, fontWeight: "600" as const, color: color.inkMuted },
};

// 向后兼容旧 theme.* 键
export const theme = {
  bg: color.bg,
  card: color.surface,
  accent: color.accent,
  line: color.line,
  muted: color.inkMuted,
  danger: color.danger,
  warn: color.warn,
  warnBg: color.warnBg,
  text: color.ink,
};
