# 独立 Mobile 视图设计 · 聊天 / 权限 / trace

日期:2026-06-01
状态:设计已确认,待写实现计划

## 背景

Web 端已上线。云端是标准的瘦客户端后端(REST + WebSocket 事件流),`src/shared/*`
逻辑模块与端无关,Web 已在复用。本设计在此之上新增一个**独立的 mobile 视图**,
而不是把 Web 的桌面取向单体(136K 的 `web/app.js`)搬到手机。

已确认的底座(均已验证存在):
- 云端 REST:`/api/auth/*`、`/api/conversations*`、`/api/me/fellows`、`/api/social/*`、
  `/api/me/settings` 等。
- 事件流:`/api/events` 是 **WebSocket**(subprotocol `mia-token.<token>`,
  `?since_seq=` 续传游标),不是 SSE。
- 权限审批链路完整:WS `approval.request` 事件 → 决策 → POST
  `/api/conversations/:id/runs/:run/approval`,allow_once / allow_always / deny
  取自 `shared/agent-permissions.js`。
- trace:消息带 `trace_json`(reasoning + tools),`shared/trace-blocks.js` 渲染。

## 决策摘要(brainstorming 产出)

| 维度 | 决定 |
| --- | --- |
| 平台形态 | Capacitor 原生壳(为真推送、原生能力) |
| 本 spec 范围 | Capacitor 壳 + 独立 mobile 视图(聊天/权限/trace),**前台靠 WS 跑通** |
| 推送 | 审批/新消息/任务三类都要 —— **另开 spec**(需云端新增 APNs/FCM) |
| 顶层导航 | 底部 Tab:消息 / 联系人 / 我(对标 Telegram) |
| 权限呈现 | 有待批请求时,决策卡作为**底部 sheet** 固定置底悬浮(拇指区,不被划走) |
| trace 呈现 | 默认收起的折叠 chip,点开看 reasoning + 工具调用 |
| 代码策略 | 薄复用 shared/* + 全新视图层,不 fork web/app.js,不引打包器 |

## 架构与复用

唯一碰网络的地方收敛到一个新模块,其余复用现有 shared 模块,视图层全新写。

```
src/shared/
  cloud-client.js     [新增] 唯一网络层:api()(Bearer + clientOpId 幂等)、
                      auth token 存取、WebSocket 事件客户端(连接 / since_seq 续传 /
                      重连退避 / 事件分发)。mobile 消费;web 暂保留其内联版本,
                      标注为「待收敛」(过渡性重复,后续可迁,本 spec 不改 web)。
  message-spec.js / send-pipeline.js / trace-blocks.js / agent-permissions.js /
  avatar-resolve.js / contact.js / unread.js / conversation-kinds.js ...   [原样复用]

src/renderer/message-sources/cloud-conversation-source.js   [复用] 渲染适配器

src/mobile/           [回收重写] 删除旧的「本机地址 + 配对 token」实现(云架构之前的遗物)
  index.html          登录视图 + 主壳(底部 Tab)+ 聊天视图
  app.js              控制器:状态、路由(列表/聊天/设置)、底部 sheet 审批状态机、
                      trace 折叠、乐观发送
  styles.css          触摸优先;安全区 env(safe-area-inset-*);底部 Tab + sheet
  manifest.json       精简复用

mobile-app/           [新增] Capacitor 工程
  capacitor.config.ts appId、webDir 指向 build 产物、打包本地资产(server.url 留空)
  ios/ android/       npx cap add 生成

scripts/
  build-mobile-www.js [新增] 拼装 src/mobile/* + 依赖的 shared/* + cloud-conversation-source
                      到 dist/mobile-www/,重写 <script src> 为扁平相对路径(契合 webDir)
  serve-mobile.js     [新增,可选] 本地浏览器调试 dev server,/api 代理到 cloud
                      (照搬 serve-web.js 代理逻辑)
```

关键边界:
- **API base 不再同源**。Web 靠 `window.location`;mobile 打包后是本地资产,
  必须指向生产 cloud 域名(`https://…`)。做成可配置常量 + 登录页可改(支持自建服务器)。
  WS 同理指向 `wss://<cloud>/api/events`。
- mobile `app.js` 不直接 `fetch`/`new WebSocket`,一律走 `cloud-client.js`。

## 界面组件

- **登录页**:用户名/密码登云端账号(与 web 同账号体系);可填服务器地址。
- **消息 Tab**:会话列表(头像 + 名字 + 末句 + 未读角标),点击进入聊天。
- **联系人 Tab**:好友 + 自有 fellow。
- **我 Tab**:账号、设置、退出。
- **聊天页**:消息气泡 + trace 折叠 chip + 输入框;有待审批时底部弹出审批 sheet
  (允许 / 拒绝 / 始终),决策后消失。

## 数据流

1. 启动 → 若有 token 直接进,否则登录拿 token。
2. 拉会话列表 + 联系人 + 设置(并行)。
3. 开 WebSocket(`mia-token.<token>` subprotocol)。新消息、`approval.request`、
   `approval.responded`、任务状态等事件经此推送,驱动界面实时刷新。
4. 发消息走乐观更新:先本地渲染 pending 气泡,服务端确认后落定(send-pipeline + clientOpId)。
5. 切后台 WS 断;回前台用持久化的 `since_seq` 续传补齐遗漏事件。

## 错误处理

- 网络断开:WS 按退避自动重连,顶部显示「连接中」细条。
- 发送失败:气泡标红可重试;clientOpId 保证重试幂等不重复发。
- 审批失效(超时 / run 已结束):底部 sheet 提示「已失效」并消失。
- API base / 服务器不可达:登录页给出明确错误,允许改地址重试。

## 测试

- shared 模块沿用现有 node 测试。
- mobile 控制器逻辑(路由、审批 sheet 状态机、乐观发送、WS 续传)写单测。
- 真机 / 模拟器手验三条主链路:收发消息、展开 trace、底部 sheet 审批。

## 明确不在本 spec(YAGNI / 留给后续)

- 推送基础设施(APNs/FCM、设备 token 注册)—— 另开 spec。
- 上架 App Store / Play(初期可自分发 / TestFlight)。
- 原生相机 / 文件选择等 Capacitor 插件能力。
- 把 web 的传输层迁移到 `cloud-client.js`(过渡期允许重复)。
- Web 与桌面之间既有的功能差距(未读 / 头像 / trace / 权限 / tasks / skills /
  附件 / cancel / cache 等)—— mobile 骑在 web 数据契约上会继承部分,但补齐不在本 spec。
