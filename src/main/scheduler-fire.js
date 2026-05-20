// src/main/scheduler-fire.js
const crypto = require("node:crypto");

function createFireRunner({ store, runRemoteChatRequest, emit, logger = console }) {
  async function fire(task) {
    const runId = "r-" + crypto.randomBytes(6).toString("hex");
    const firedAt = Date.now();
    emit("started", { taskId: task.id, runId, sessionId: task.sessionId });
    try {
      const result = await runRemoteChatRequest({
        fellowKey: task.fellowId,
        sessionId: task.sessionId,
        text: task.prompt,
        displayText: task.prompt,
        meta: { taskId: task.id, taskRunId: runId }
      });
      // Identify the message id of the assistant reply we just appended.
      // runRemoteChatRequest currently appends to session.messages; the last
      // assistant message is ours.
      const messages = result?.session?.messages || [];
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      const outputMessageId = result?.assistantMessageId || lastAssistant?.id || null;
      const run = store.recordRun(task.id, {
        id: runId,
        firedAt,
        finishedAt: Date.now(),
        status: "ok",
        outputMessageId
      });
      emit("finished", {
        taskId: task.id,
        runId: run.id,
        sessionId: task.sessionId,
        messageId: outputMessageId,
        status: "ok"
      });
      return run;
    } catch (e) {
      logger.error?.("[scheduler-fire] task failed", task.id, e);
      const run = store.recordRun(task.id, {
        id: runId,
        firedAt,
        finishedAt: Date.now(),
        status: "failed",
        error: String(e?.message || e)
      });
      emit("failed", {
        taskId: task.id,
        runId: run.id,
        sessionId: task.sessionId,
        error: run.error
      });
      return run;
    }
  }
  return { fire };
}

module.exports = { createFireRunner };
