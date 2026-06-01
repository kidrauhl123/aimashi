import { buildConversationListItems } from "../src/logic/conversationList";

test("按最后活动倒序 + 未读 + 末句", () => {
  const items = buildConversationListItems({
    conversations: [
      { id: "dm:a", name: "Alice", last_message_text: "hi", last_activity_at: "2026-06-01T10:00:00Z" },
      { id: "fellow::bob", name: "Bob", last_message_text: "done", last_activity_at: "2026-06-01T12:00:00Z" },
    ],
    unreadByConversation: { "dm:a": 3 },
  });
  expect(items[0].id).toBe("fellow::bob");
  expect(items[0].unread).toBe(0);
  expect(items[0].avatar.image).toBe("");
  expect(items[0].avatar.text).toBe("Bo");
  expect(items[1].id).toBe("dm:a");
  expect(items[1].unread).toBe(3);
  expect(items[1].subtitle).toBe("hi");
  expect(items[1].avatar.text).toBe("Al");
});

test("缺字段降级", () => {
  const items = buildConversationListItems({ conversations: [{ id: "dm:x" }] });
  expect(items[0].title).toBe("dm:x");
  expect(items[0].subtitle).toBe("");
  expect(items[0].unread).toBe(0);
  expect(items[0].avatar.image).toBe("");
  expect(items[0].avatar.text).toBe("dm");
});

test("旧预设头像在移动端会降级为统一文字头像", () => {
  const items = buildConversationListItems({
    conversations: [
      {
        id: "fellow::kongling",
        name: "空铃",
        identity: { avatar: { image: "./assets/avatars/12.png", crop: { x: 10 }, color: "#65aadd", text: "空铃" } },
      },
    ],
  });
  expect(items[0].avatar.image).toBe("");
  expect(items[0].avatar.crop).toBeNull();
  expect(items[0].avatar.text).toBe("空铃");
});
