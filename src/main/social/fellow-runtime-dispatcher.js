"use strict";

const { CloudEvent } = require("../../shared/cloud-events.js");
const { buildInvocation } = require("./fellow-invocation.js");

function createMainFellowRuntimeDispatcher({
  shouldHandle = () => true,
  listFellows = () => [],
  localFellowResponder,
  log = () => {}
} = {}) {
  function canHandle() {
    return typeof shouldHandle === "function" ? Boolean(shouldHandle()) : true;
  }

  async function handleFellowInvocationRequested(message = {}) {
    if (!canHandle()) return false;
    if (!localFellowResponder || typeof localFellowResponder.respond !== "function") return false;
    const args = buildInvocation(message, listFellows());
    if (!args) return false;
    return Boolean(await localFellowResponder.respond(args));
  }

  async function handleCloudEvent(message = {}) {
    if (message.type !== CloudEvent.ConversationFellowInvocationRequested) return false;
    try {
      return await handleFellowInvocationRequested(message);
    } catch (error) {
      log(`Cloud fellow invocation failed: ${error?.message || error}`);
      return false;
    }
  }

  return { handleCloudEvent, handleFellowInvocationRequested };
}

module.exports = { createMainFellowRuntimeDispatcher };
