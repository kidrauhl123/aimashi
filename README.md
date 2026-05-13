# Aimashi

Aimashi 是一个基于 Electron 的桌面应用，
##### （一）兼容的 Agent 引擎
###### 1. 运行在 PC 本地
1. 内置独立的 Hermes
	- 为避免污染用户系统中已有的 Hermes 安装，Aimashi **不会**读取、修改或复用任何外部 Hermes 目录。首次启动时，它会在应用数据目录下创建自己的运行时空间：
2. 可识别本地的 Claude Code 和 Codex
	- 如果用户本地安装了 Claude Code CLI 或 Codex CLI，本 APP 会
###### 2. 运行在云端
- Hermes
##### （二）创建人设各异的多个 Agent 伙伴
###### Hermes
```text
~/Library/Application Support/Aimashi/runtime/
  hermes-engine/
    README.md
    .venv/
      ...
  engine-home/
    config.yaml
    SOUL.md
    api-server.key
    fellows/
      manifest.json
      aimashi.fellow.json
      aimashi.md
```

- `fellows/`：面向产品的目录结构。每个 Fellow（伙伴）由一份 `<id>.fellow.json` 元数据 + 一份 `<id>.md` 人格 seed 组成。

##### （三）宠物功能
- 基于多伙伴的设定，每个 Agent 伙伴均可生成一个桌宠

##### （四）多端互通
- 手机/web/桌面 APP
