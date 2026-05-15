function parseMentions(content, fellows) {
  const result = [];
  const seen = new Set();
  const nameToId = new Map(fellows.map((f) => [f.name.toLowerCase(), f.id]));
  // \\@ 转义跳过；其他 @name 匹配（name = 字母数字下划线+中日韩字符）
  const regex = /(\\@|@([A-Za-z0-9_一-龥぀-ヿ]+))/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1] === "\\@") continue;
    const name = match[2].toLowerCase();
    const id = nameToId.get(name);
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

function filterRecentTurnsForFellow(messages, fellowId, k) {
  const turnsTouchingFellow = [];
  const seenTurns = new Set();
  for (const msg of messages) {
    if (seenTurns.has(msg.turnId)) continue;
    const touches =
      (msg.mentions && msg.mentions.includes(fellowId)) ||
      msg.senderFellowId === fellowId;
    if (touches) {
      turnsTouchingFellow.push(msg.turnId);
      seenTurns.add(msg.turnId);
    }
  }
  const lastK = new Set(turnsTouchingFellow.slice(-k));
  return messages.filter((m) => lastK.has(m.turnId));
}

module.exports = { parseMentions, filterRecentTurnsForFellow };
