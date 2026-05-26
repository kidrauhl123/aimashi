"use strict";

const { CloudEvent } = require("../../shared/cloud-events.js");
const { buildInvocation } = require("./fellow-invocation.js");

function createMainFellowRuntimeDispatcher({
  shouldHandle = () => true,
  listFellows = () => [],
  localFellowResponder,
  mainGroupConductor,
  mainFellowRoomResponder,
  log = () => {}
} = {}) {
  function canHandle() {
    return typeof shouldHandle === "function" ? Boolean(shouldHandle()) : true;
  }

  async function invokeFellow(args = {}) {
    const runtimeKind = String(args.runtimeKind || "desktop-local").trim() || "desktop-local";
    if (runtimeKind !== "desktop-local") return false;
    if (!localFellowResponder || typeof localFellowResponder.respond !== "function") return false;
    return Boolean(await localFellowResponder.respond(args));
  }

  async function handleFellowInvocationRequested(message = {}) {
    if (!canHandle()) return false;
    const args = buildInvocation(message, listFellows());
    if (!args) return false;
    return invokeFellow(args);
  }

  async function handleRoomMessageAppended(message = {}) {
    if (!canHandle()) return false;
    const args = {
      roomId: message.roomId || message.room_id,
      message: message.message
    };
    const tasks = [];
    if (mainGroupConductor && typeof mainGroupConductor.handleRoomMessageAppended === "function") {
      tasks.push(
        mainGroupConductor.handleRoomMessageAppended(args)
          .catch((error) => log(`Cloud group conductor failed: ${error?.message || error}`))
      );
    }
    if (mainFellowRoomResponder && typeof mainFellowRoomResponder.handleRoomMessageAppended === "function") {
      tasks.push(
        mainFellowRoomResponder.handleRoomMessageAppended(args)
          .catch((error) => log(`Cloud fellow room responder failed: ${error?.message || error}`))
      );
    }
    await Promise.all(tasks);
    return tasks.length > 0;
  }

  async function handleCloudEvent(message = {}) {
    if (message.type === CloudEvent.RoomFellowInvocationRequested) {
      try {
        return await handleFellowInvocationRequested(message);
      } catch (error) {
        log(`Cloud fellow invocation failed: ${error?.message || error}`);
        return false;
      }
    }
    if (message.type === CloudEvent.RoomMessageAppended) {
      return handleRoomMessageAppended(message);
    }
    return false;
  }

  return {
    invokeFellow,
    handleCloudEvent,
    handleFellowInvocationRequested,
    handleRoomMessageAppended
  };
}

module.exports = { createMainFellowRuntimeDispatcher };
