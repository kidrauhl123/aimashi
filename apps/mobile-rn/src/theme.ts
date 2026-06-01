// Swiss Signal 设计系统:纯白 / 纯黑 / 信号橙,粗体无衬线、网格、锐利、克制。
// 旧键名(bg/card/accent/line/muted/danger/warn/warnBg/text)保留并重映射到 Swiss 值,
// 让既有组件零改动吃到新配色;关键组件再单独精修。

export const color = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceAlt: "#F4F4F4", // 输入框 / 对方气泡的浅灰填充
  ink: "#0A0A0A", // 近纯黑,主文字 & 强描边
  inkMuted: "#737373",
  inkFaint: "#A3A3A3",
  rule: "#0A0A0A", // 强黑分隔/描边(卡片、按钮轮廓、标题下规则线)
  hairline: "#E6E6E6", // 轻分隔(列表行、输入框)
  accent: "#FF4D00", // 信号橙 —— 全局唯一强调色
  accentText: "#FFFFFF",
  danger: "#E5484D",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { none: 0, sm: 4, md: 8, pill: 999 };
export const hairlineWidth = 1;

// 字体:中文走系统体(系统会用 PingFang/Noto),拉丁/品牌/数字用 Archivo 粗体注入腔调。
export const font = {
  display: "Archivo_800ExtraBold",
  displayBlack: "Archivo_900Black",
  semibold: "Archivo_600SemiBold",
};

export const type = {
  brand: { fontFamily: font.displayBlack, fontSize: 30, letterSpacing: 1, color: color.ink },
  // 屏幕标题:大写、粗、字距(拉丁更出味;中文也偏粗)
  title: { fontFamily: font.display, fontSize: 17, letterSpacing: 0.5, color: color.ink },
  body: { fontSize: 15, lineHeight: 21, color: color.ink },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "700" as const, color: color.ink },
  sub: { fontSize: 13, color: color.inkMuted },
  // 小号大写标签(section label / 状态)
  label: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.2, color: color.inkMuted },
  mono: { fontFamily: "Courier", fontSize: 12, color: color.inkMuted },
};

// 向后兼容旧 theme.* 键(值已替换为 Swiss)
export const theme = {
  bg: color.bg,
  card: color.surface,
  accent: color.accent,
  line: color.hairline,
  muted: color.inkMuted,
  danger: color.danger,
  warn: color.ink,
  warnBg: color.surface,
  text: color.ink,
};
