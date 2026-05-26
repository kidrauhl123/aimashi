(function attachAvatarMedia(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.miaAvatarMedia = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function buildAvatarMedia() {
  const MAX_TRIM_DURATION = 5;
  const MIN_TRIM_DURATION = 1;
  const DEFAULT_TRIM_DURATION = 3;
  const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|ogv|ogg)(?:[?#].*)?$/i;
  const GIF_EXT_RE = /\.gif(?:[?#].*)?$/i;
  const IMAGE_EXT_RE = /\.(png|jpe?g|webp|avif|svg)(?:[?#].*)?$/i;

  function mediaKind(value = "") {
    const src = String(value || "").trim();
    if (!src) return "";
    if (/^data:video\//i.test(src) || VIDEO_EXT_RE.test(src)) return "video";
    if (/^data:image\/gif/i.test(src) || GIF_EXT_RE.test(src)) return "gif";
    if (/^data:image\//i.test(src) || IMAGE_EXT_RE.test(src)) return "image";
    return "";
  }

  function isVideo(value) {
    return mediaKind(value) === "video";
  }

  function isGif(value) {
    return mediaKind(value) === "gif";
  }

  function normalizeTrim(trim = {}) {
    const num = (value, fallback, min, max) => {
      const next = Number(value);
      if (!Number.isFinite(next)) return fallback;
      return Math.max(min, Math.min(max, next));
    };
    return {
      start: Math.round(num(trim.start ?? trim.trimStart, 0, 0, 3600) * 100) / 100,
      duration: Math.round(num(trim.duration ?? trim.trimDuration, DEFAULT_TRIM_DURATION, MIN_TRIM_DURATION, MAX_TRIM_DURATION) * 100) / 100
    };
  }

  function trimFromCrop(crop = {}) {
    return normalizeTrim({
      start: crop.start ?? crop.trimStart,
      duration: crop.duration ?? crop.trimDuration
    });
  }

  function cropWithTrim(crop = {}, trim = {}) {
    const normalized = normalizeTrim(trim);
    return {
      ...(crop || {}),
      start: normalized.start,
      duration: normalized.duration
    };
  }

  return {
    MAX_TRIM_DURATION,
    MIN_TRIM_DURATION,
    DEFAULT_TRIM_DURATION,
    mediaKind,
    isVideo,
    isGif,
    normalizeTrim,
    trimFromCrop,
    cropWithTrim
  };
});
