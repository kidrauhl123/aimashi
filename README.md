# Mia

Mia 是一个 Electron 桌面端为主的 AI Fellow 工作台。它把本机 Agent 引擎、云端聊天房间、好友/群聊、权限确认、技能、桌宠和 Web 入口放到一套 GUI 里。

当前项目不是单一桌面 demo，而是几条链路一起工作：

- 桌面端：Electron 主进程、preload、renderer GUI、本机运行时、IPC、任务调度、桌宠窗口。
- 本机 Agent：随包 Hermes runtime，以及用户机器上已经安装并登录的 Claude Code / Codex CLI。
- Cloud：账号、好友、DM、群房间、消息同步、文件上传、WebSocket 事件、桌面 bridge、云端 Hermes worker。
- Web：宣传页、Web 聊天壳、模型 admin 页面。
- Mobile / Relay：保留的移动端和 relay 远控链路，不是当前主开发路径。

## 快速开始

安装依赖：

```bash
npm install
```

启动桌面端：

```bash
npm start
```

常用脚本：

```bash
npm test                         # Node test 全量测试
npm run check                    # 结构、语法和关键 contract 自检
npm run open                     # 等同于 Electron 打开桌面端
npm run web                      # 本地 Web 静态服务，默认 127.0.0.1:4174
npm run cloud                    # 本地 Cloud API，默认 127.0.0.1:4175
npm run bridge                   # 本地 agent bridge，连接 Cloud 后执行远程 run
npm run relay                    # relay server
npm run desktop:permission-smoke # 桌面权限弹窗 smoke
```

Cloud / SQLite 相关路径使用 `node:sqlite`，需要支持该模块的 Node 版本。生产和发布脚本按当前项目约束使用 Node 25+。

## 主要目录

```text
src/
  main.js                  Electron 主进程装配入口
  main/                    主进程服务、IPC、引擎适配、权限、cloud/relay/daemon 客户端
  preload.js               renderer 可访问能力的窄桥
  renderer/                桌面 GUI
  shared/                  main / preload / renderer / web / tests 共用 contract
  cloud/                   Cloud API 的 SQLite store、社交、消息、技能市场、用户设置
  cloud-agent/             云端 Hermes worker、run store、runtime binding、附件落盘
  web/                     线上宣传页和 Web app shell
  mobile/                  移动端页面
  relay/                   relay server
resources/
  conductor/               conductor 默认 prompt
  pet-generator/           桌宠生成资源
scripts/                   本地服务、cloud 发布、runtime 构建、诊断和 smoke 脚本
skills/                    Mia 内置 skill
tests/                     node:test 测试
vendor/
  hermes-runtime/          随包 Hermes runtime 构建产物
```

## 桌面端架构

`src/main.js` 仍是装配入口，但大量职责已经拆到 `src/main/`：

- Agent 引擎适配：`hermes-chat-adapter.js`、`claude-code-chat-adapter.js`、`codex-chat-adapter.js`、`chat-engine-registry.js`。
- 会话与消息：`chat-session-service.js`、`chat-store.js`、`chat-response.js`、`chat-events.js`。
- 权限与外部执行：`agent-permission-coordinator.js`、`external-agent-command-service.js`、`codex-app-server-runner.js`。
- 运行时管理：`runtime-paths.js`、`runtime-initializer-service.js`、`runtime-lifecycle-service.js`、`engine-*` 服务。
- Fellow 与社交：`fellow-*`、`social/*`、`cloud/*`。
- 调度与任务：`scheduler*.js`、`tasks-*.js`、`daemon/*`。

Renderer 入口是 `src/renderer/app.js`，UI 子功能继续拆在：

- `renderer/chat/`
- `renderer/fellow/`
- `renderer/social/`
- `renderer/settings/`
- `renderer/tasks/`
- `renderer/message-sources/`
- `renderer/styles/*.css`

Renderer 不直接使用 Node/Electron 能力，需要系统能力时通过 `preload.js` 暴露的 API 和 `src/shared/ipc-channels.js` 里的 channel 走 IPC。

## Agent 引擎边界

Mia 当前支持三类 Fellow 引擎：

- `hermes`：Mia 随包的 Hermes runtime。构建脚本是 `scripts/build-hermes-runtime.sh`，产物在 `vendor/hermes-runtime/<target>/`。
- `claude-code`：用户本机 Claude Code CLI。Mia 通过 SDK/本机命令适配，不把 CLI 打进安装包。
- `codex`：用户本机 Codex CLI / Codex SDK。权限、会话和 Codex App Server 路径由本机环境决定。

硬边界：

- 不要把 Claude Code / Codex 二进制加入 Electron `extraResources`。
- Hermes 是随包 runtime；Claude Code / Codex 是用户环境里的外部工具。
- Fellow 的名字、头像、人设、技能、权限模式和引擎配置属于 Mia 的产品层，不属于某个单独 CLI。

## Cloud 和 Web

Cloud 服务入口是 `scripts/serve-cloud.js`。它组合：

- `src/cloud/sqlite-store.js`
- `src/cloud/social-store.js`
- `src/cloud/messages-store.js`
- `src/cloud/fellows-store.js`
- `src/cloud/skills-store.js`
- `src/cloud/user-settings-store.js`
- `src/cloud-agent/*`

本地默认：

```text
MIA_CLOUD_HOST=127.0.0.1
MIA_CLOUD_PORT=4175
MIA_CLOUD_DATA=.mia-cloud
```

Web 服务入口是 `scripts/serve-web.js`，默认读取 `src/web/`，并把 `/api/*` 代理到本地 Cloud：

```text
MIA_WEB_PORT=4174
MIA_WEB_API_TARGET=http://127.0.0.1:4175
```

线上生产入口当前是：

```text
https://aiweb.buytb01.com
```

WebSocket 鉴权优先走 `Sec-WebSocket-Protocol` 中的 `mia-token.<token>`，避免把 bearer token 放进 URL。测试环境可以通过 `MIA_CLOUD_ALLOW_QUERY_TOKEN=1` 放开 query token。

## 本地 bridge

`scripts/local-agent-bridge.js` 连接 Cloud 的 `/api/bridge` WebSocket，把云端发来的 run 路由到本机执行。常用环境变量：

```text
MIA_CLOUD_URL=http://127.0.0.1:4175
MIA_CLOUD_TOKEN=<token>
MIA_CLOUD_USERNAME=<username>
MIA_CLOUD_PASSWORD=<password>
MIA_BRIDGE_ENGINE=codex
MIA_BRIDGE_NAME=<device-name>
MIA_BRIDGE_CWD=<working-directory>
```

如果没有 `MIA_CLOUD_TOKEN`，bridge 会尝试用 username/password 登录 Cloud。附件会落到临时目录，生成图片会从 Codex 生成目录回收并回传到 Cloud。

## 用户数据和运行时目录

桌面端默认用户数据目录：

```text
~/Library/Application Support/Mia/
```

测试或自动化应使用 `MIA_USER_DATA_DIR` 指向临时目录，避免写真实用户数据。

典型运行时结构：

```text
runtime/
  engine-home/
    config.yaml
    auth.json
    mia-model.json
    mia-providers.json
    mia-permissions.json
    mia-sessions.json
    mia-agent-sessions.json
    fellows/
    pets/
    pet-jobs/
    attachments/
    logs/
```

## 打包和发布

构建 Hermes runtime：

```bash
npm run hermes:runtime
npm run hermes:runtime:mac-arm64
npm run hermes:runtime:mac-x64
npm run hermes:runtime:linux-x64
npm run hermes:runtime:win-x64
```

构建 macOS unsigned 包：

```bash
npm run dist:mac
```

Cloud release：

```bash
npm run cloud:release
npm run cloud:deploy:dry-run
npm run cloud:deploy
npm run cloud:prod:verify -- https://aiweb.buytb01.com
```

Cloud 发布包会生成到：

```text
dist/mia-cloud-release/
dist/mia-cloud-release.tgz
dist/mia-cloud-release.tgz.sha256
```

生产部署说明见 `docs/cloud-deployment.md`。部署脚本会安装 API、Web 静态文件、systemd、nginx、Cloud Hermes worker 和 LiteLLM 相关配置。

## 测试策略

项目主要使用 `node:test`。高频验证：

```bash
npm test
npm run check
```

局部开发时可以直接跑相关测试：

```bash
node --test tests/chat-session-service.test.js
node --test tests/serve-cloud-bridge.test.js
node --test tests/web-landing.test.js
```

`npm run check` 会检查关键文件存在、JS 语法、shell 脚本语法、权限模式、引擎 registry、runtime path、Cloud 服务边界等结构性约束。

## 开发规则

- 新代码优先放进按领域命名的模块，不继续扩大 `src/main.js`、`src/renderer/app.js`、`src/renderer/styles.css`。
- 跨进程字符串、engine id、permission mode、cloud event type 等 contract 必须集中到 `src/shared/` 或所属 feature 的常量模块。
- Renderer 不直接访问 Node/Electron。
- Main 不写 DOM。
- Cloud、Web、Mobile、Desktop 的状态 owner 要清楚，同一类会话状态只能有一个权威来源。
- 持久化 schema 改动必须兼容已有数据，并可重复运行。
- Secret 不写入仓库，不进 README 示例，不打印到日志。
- 高频 stream、heartbeat、polling 不打 info 日志。

## 当前限制

- `src/main.js`、`src/renderer/app.js`、`src/renderer/styles.css` 仍偏大，后续改动应继续拆分。
- Web 端不能直接运行用户本机 Fellow；远程 Fellow 调用需要 owner 桌面端在线，或云端 Hermes worker 可用。
- Cloud agent 和桌面 agent 的能力边界仍在演进，特别是权限、附件、生成图片、取消和流式进度。
- 桌宠生成依赖本机可用的图像生成能力和对应运行环境。
- macOS 签名、公证和自动更新还不是完整生产链路。
- Mobile / Relay 目录仍保留，但不是当前主要产品面。
