const { IpcChannel } = require("../../shared/ipc-channels");
const { CloudEvent } = require("../../shared/cloud-events.js");

function safeCall(fn) {
  return async (_event, ...args) => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error?.message || error), status: error?.status || 500 };
    }
  };
}

function dispatchPostedRoomMessage({ roomId, result, fellowRuntimeDispatcher, log = () => {} }) {
  const message = result?.message || result?.data?.message || null;
  if (!roomId || !message?.id || message.sender_kind !== "user") return;
  const promise = fellowRuntimeDispatcher?.handleCloudEvent?.({
    type: CloudEvent.RoomMessageAppended,
    roomId,
    message
  });
  promise?.catch?.((error) => log(`Cloud room AI dispatch after post failed: ${error?.message || error}`));
}

function registerSocialIpc({ ipcMain, socialApi, fellowRuntimeDispatcher = null, log = () => {} }) {
  ipcMain.handle(IpcChannel.SocialSendFriendRequest, safeCall((toUsername) => socialApi.sendFriendRequest(toUsername)));
  ipcMain.handle(IpcChannel.SocialRespondFriendRequest, safeCall((requestId, action) => socialApi.respondFriendRequest(requestId, action)));
  ipcMain.handle(IpcChannel.SocialCancelFriendRequest, safeCall((requestId) => socialApi.cancelFriendRequest(requestId)));
  ipcMain.handle(IpcChannel.SocialListFriendRequests, safeCall((direction) => socialApi.listFriendRequests(direction)));
  ipcMain.handle(IpcChannel.SocialListFriends, safeCall(() => socialApi.listFriends()));
  ipcMain.handle(IpcChannel.SocialRemoveFriend, safeCall((userId) => socialApi.removeFriend(userId)));
  ipcMain.handle(IpcChannel.SocialListRooms, safeCall(() => socialApi.listRooms()));
  ipcMain.handle(IpcChannel.SocialListFellows, safeCall(() => socialApi.listFellows()));
  ipcMain.handle(IpcChannel.SocialSaveFellowIdentity, safeCall((fellowId, body) => socialApi.saveFellowIdentity(fellowId, body)));
  ipcMain.handle(IpcChannel.SocialDeleteFellow, safeCall((fellowId) => socialApi.deleteFellow(fellowId)));
  ipcMain.handle(IpcChannel.SocialListPlatformModels, safeCall(() => socialApi.listPlatformModels()));
  ipcMain.handle(IpcChannel.SocialGetRoom, safeCall((roomId) => socialApi.getRoom(roomId)));
  ipcMain.handle(IpcChannel.SocialListRoomMessages, safeCall((roomId, sinceSeq, limit) => socialApi.listRoomMessages(roomId, sinceSeq, limit)));
  ipcMain.handle(IpcChannel.SocialPostRoomMessage, safeCall(async (roomId, body) => {
    const result = await socialApi.postRoomMessage(roomId, body);
    dispatchPostedRoomMessage({ roomId, result, fellowRuntimeDispatcher, log });
    return result;
  }));
  ipcMain.handle(IpcChannel.SocialDeleteRoomMessage, safeCall((roomId, messageId) => socialApi.deleteRoomMessage(roomId, messageId)));
  ipcMain.handle(IpcChannel.SocialCreateRoom, safeCall((payload) => socialApi.createRoom(payload)));
  ipcMain.handle(IpcChannel.SocialEnsureFellowRoom, safeCall((fellowId, body) => socialApi.ensureFellowRoom(fellowId, body)));
  ipcMain.handle(IpcChannel.SocialEnsureFellowSessionRoom, safeCall((sessionId, body) => socialApi.ensureFellowSessionRoom(sessionId, body)));
  ipcMain.handle(IpcChannel.SocialGetFellowRuntime, safeCall((fellowId, runtimeKind) => socialApi.getFellowRuntime(fellowId, runtimeKind)));
  ipcMain.handle(IpcChannel.SocialSaveFellowRuntime, safeCall((fellowId, body) => socialApi.saveFellowRuntime(fellowId, body)));
  ipcMain.handle(IpcChannel.SocialUpdateRoom, safeCall((roomId, patch) => socialApi.updateRoom(roomId, patch)));
  ipcMain.handle(IpcChannel.SocialDeleteRoom, safeCall((roomId) => socialApi.deleteRoom(roomId)));
  ipcMain.handle(IpcChannel.SocialAddRoomMember, safeCall((roomId, member) => socialApi.addRoomMember(roomId, member)));
  ipcMain.handle(IpcChannel.SocialRemoveRoomMember, safeCall((roomId, member) => socialApi.removeRoomMember(roomId, member)));
}

module.exports = { registerSocialIpc };
