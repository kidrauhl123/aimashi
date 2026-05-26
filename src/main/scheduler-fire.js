// src/main/scheduler-fire.js
const crypto = require("node:crypto");

function safeRecordRun(store, taskId, run) {
  try {
    return store.recordRun(taskId, run);
  } catch (e) {
    if (/task not found/i.test(String(e?.message))) return null;
    throw e;
  }
}

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
        // Run independently of the interactive single-flight abort controller so
        // foreground/web chat (or an overlapping task) can't abort this run.
        background: true,
        meta: { taskId: task.id, taskRunId: runId, firedAt }
      });
      // Identify the message id of the assistant reply we just appended.
      // runRemoteChatRequest currently appends to session.messages; the last
      // assistant message is ours.
      const messages = result?.session?.messages || [];
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      const outputMessageId = result?.assistantMessageId || lastAssistant?.id || null;
      // Persist the reply text on the run itself. The task store is written only
      // by the daemon, so this copy is race-free — unlike the chat session, whose
      // cross-process writes can drop the appended message (known issue).
      const outputText = String(lastAssistant?.content || "");
      const run = safeRecordRun(store, task.id, {
        id: runId,
        firedAt,
        finishedAt: Date.now(),
        status: "ok",
        outputMessageId,
        outputText
      });
      emit("finished", {
        taskId: task.id,
        runId: run?.id || runId,
        sessionId: task.sessionId,
        fellowId: task.fellowId,
        messageId: outputMessageId,
        outputText,
        createdAt: lastAssistant?.createdAt || new Date(firedAt).toISOString(),
        status: "ok"
      });
      return run;
    } catch (e) {
      logger.error?.("[scheduler-fire] task failed", task.id, e);
      const run = safeRecordRun(store, task.id, {
        id: runId,
        firedAt,
        finishedAt: Date.now(),
        status: "failed",
        error: String(e?.message || e)
      });
      emit("failed", {
        taskId: task.id,
        runId: run?.id || runId,
        sessionId: task.sessionId,
        error: run?.error || String(e?.message || e)
      });
      return run;
    }
  }
  return { fire };
}

module.exports = { createFireRunner, safeRecordRun };
