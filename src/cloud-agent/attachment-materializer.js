const fs = require("node:fs");
const path = require("node:path");

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

function sanitizeAttachmentName(value, fallback = "attachment") {
  const base = path.basename(String(value || "").replace(/[\x00-\x1f\x7f]/g, "").trim());
  const cleaned = base.replace(/[^\w.\- ()\[\]\u4e00-\u9fff]/g, "_").slice(0, 160);
  return cleaned || fallback;
}

function attachmentKind(input = {}) {
  const mime = String(input.mimeType || input.mime || "").toLowerCase();
  const name = String(input.name || "").toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(name)) return "image";
  if (mime.startsWith("text/") || /\.(txt|md|markdown|json|csv|tsv|log|js|ts|tsx|jsx|css|html|xml|yaml|yml)$/i.test(name)) return "text";
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  return "file";
}

function parseAttachmentsFromMessage(message = {}) {
  if (Array.isArray(message.attachments)) return message.attachments;
  if (!message.attachments_json) return [];
  try {
    const parsed = JSON.parse(String(message.attachments_json || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_ATTACHMENT_BYTES) return null;
  return { mimeType: match[1], buffer };
}

function cloudFileIdFromAttachment(attachment = {}) {
  const url = String(attachment.url || "").trim();
  const urlMatch = url.match(/^\/api\/files\/([A-Za-z0-9_-]+)$/);
  if (urlMatch) return urlMatch[1];
  const id = String(attachment.id || "").trim();
  return /^file_[A-Za-z0-9_-]+$/.test(id) ? id : "";
}

function safeJoin(root, fileName) {
  const target = path.join(root, fileName);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe attachment target path.");
  }
  return target;
}

function textPreviewForAttachment(attachment = {}, fsImpl = fs) {
  if (attachment.kind !== "text" || !attachment.hostPath) return "";
  let stat = null;
  try {
    stat = fsImpl.statSync(attachment.hostPath);
  } catch {
    return "";
  }
  if (!stat.isFile() || stat.size > MAX_TEXT_PREVIEW_BYTES) return "";
  try {
    return fsImpl.readFileSync(attachment.hostPath, "utf8").slice(0, 12000);
  } catch {
    return "";
  }
}

function attachmentSummaryLine(attachment, index) {
  const parts = [
    `附件 ${index + 1}: ${attachment.name || "attachment"}`,
    `类型=${attachment.mimeType || attachment.kind || "unknown"}`,
    `大小=${attachment.size || 0} bytes`,
    `路径=${attachment.path}`
  ];
  return `- ${parts.join("；")}`;
}

function attachmentContext(attachments = [], fsImpl = fs) {
  const visible = attachments.filter((item) => item?.path || item?.name);
  if (!visible.length) return "";
  const lines = [
    "本轮用户附带了以下附件。你可以在云端 worker 内直接读取这些容器路径；这些路径只属于当前用户，不能假设可访问其他用户文件。",
    ...visible.map(attachmentSummaryLine)
  ];
  const previews = visible
    .map((attachment, index) => {
      const preview = textPreviewForAttachment(attachment, fsImpl);
      return preview ? `附件 ${index + 1} 文本预览（${attachment.name}）：\n${preview}` : "";
    })
    .filter(Boolean);
  return [...lines, ...previews].join("\n\n");
}

function inputWithAttachmentContext(text, attachments = [], fsImpl = fs) {
  const context = attachmentContext(attachments, fsImpl);
  return [String(text || ""), context ? `附件上下文：\n${context}` : ""].filter(Boolean).join("\n\n");
}

function createAttachmentMaterializer(deps = {}) {
  const cloudStore = deps.cloudStore;
  const fsImpl = deps.fs || fs;

  function materialize(args = {}) {
    if (!cloudStore) return { attachments: [], dir: "", input: String(args.text || "") };
    const userId = String(args.userId || "").trim();
    const workerPaths = args.workerPaths || {};
    const incoming = Array.isArray(args.attachments) ? args.attachments.slice(0, 20) : [];
    if (!userId || !workerPaths.attachments || !incoming.length) {
      return { attachments: [], dir: "", input: String(args.text || "") };
    }
    const runSegment = sanitizeAttachmentName(args.runId || `run-${Date.now()}`, "run");
    const runDir = path.join(workerPaths.attachments, runSegment);
    fsImpl.mkdirSync(runDir, { recursive: true, mode: 0o700 });

    const materialized = [];
    for (const [index, attachment] of incoming.entries()) {
      const declaredName = sanitizeAttachmentName(attachment.name || `attachment-${index + 1}`);
      const cloudFileId = cloudFileIdFromAttachment(attachment);
      const dataUrl = dataUrlToBuffer(attachment.dataUrl);
      let sourceFile = null;
      let sourceBuffer = null;
      let mimeType = String(attachment.mimeType || attachment.mime || "").trim();
      let size = 0;

      if (dataUrl) {
        sourceBuffer = dataUrl.buffer;
        mimeType = mimeType || dataUrl.mimeType;
        size = sourceBuffer.length;
      } else if (cloudFileId) {
        sourceFile = cloudStore.getFileForUser(userId, cloudFileId);
        if (!sourceFile || !sourceFile.path) continue;
        mimeType = mimeType || sourceFile.mimeType || sourceFile.mime || "";
        size = Number(sourceFile.size || 0);
      } else {
        continue;
      }

      const name = sanitizeAttachmentName(sourceFile?.name || declaredName, `attachment-${index + 1}`);
      const target = safeJoin(runDir, `${index + 1}-${name}`);
      if (sourceBuffer) {
        fsImpl.writeFileSync(target, sourceBuffer, { mode: 0o600 });
      } else {
        const stat = fsImpl.statSync(sourceFile.path);
        if (!stat.isFile() || stat.size > MAX_ATTACHMENT_BYTES) continue;
        fsImpl.copyFileSync(sourceFile.path, target);
        fsImpl.chmodSync(target, 0o600);
        size = stat.size;
      }
      const publicPath = `/data/attachments/${runSegment}/${path.basename(target)}`;
      materialized.push({
        id: cloudFileId || String(attachment.id || `attachment-${index + 1}`),
        name,
        mimeType,
        size,
        kind: attachmentKind({ mimeType, name }),
        path: publicPath,
        hostPath: target
      });
    }

    return {
      attachments: materialized,
      dir: runDir,
      input: inputWithAttachmentContext(args.text || "", materialized, fsImpl)
    };
  }

  return { materialize };
}

module.exports = {
  createAttachmentMaterializer,
  parseAttachmentsFromMessage,
  attachmentContext,
  inputWithAttachmentContext
};
