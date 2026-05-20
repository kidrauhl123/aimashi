const crypto = require("node:crypto");

function chatCompletionResponse({ id, model, content, attachments = [], finishReason = "stop", aimashi = {} }) {
  const message = {
    role: "assistant",
    content: content || ""
  };
  if (Array.isArray(attachments) && attachments.length) message.attachments = attachments;
  return {
    id: id || `chatcmpl_${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason
      }
    ],
    aimashi
  };
}

function responseMessageContent(response) {
  return String(response?.choices?.[0]?.message?.content || "").trim();
}

module.exports = {
  chatCompletionResponse,
  responseMessageContent
};
