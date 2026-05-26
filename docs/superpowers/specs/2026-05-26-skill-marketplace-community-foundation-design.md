# 技能市场 · 社区化基础架构 设计

日期：2026-05-26
状态：已定承重决策，待切 slice + 实现

## 背景

当前市场（B slice-1/2/3）是**一方策展、单文件**模型：cloud `skills` 表只有一个 `body` 字段，安装 = 写一个 SKILL.md。它撑不起"蓬勃发展的社区市场"，硬天花板有四个：① 只有官方能发布；② 只能存单文件（带 scripts/references 的 skill —— 比如 pet-generator 自己 —— 进不了市场）；③ 没有版本/更新；④ 没有信任/安全。

参考 LobsterAI：skill = **目录**，"包" = zip/git archive，`downloadSkill` 支持 本地目录/zip/远程 zip/npm/ClawHub/git，带 `version`(semver) 与 `auditReport`；ClawHub 是其外部 hub。本设计把 Mia 的市场升级到同一量级，但 registry 由 Mia Cloud 自托管。

## 承重决策（已定，expensive to change）

1. **内容模型 = 打包目录（zip）+ 版本**，取代单 `body`。skill 是多文件目录，按 version 打成 zip。
2. **包存储 = VPS 文件系统** `uploads/skills/<id>/<version>.zip`，表里存相对路径 + checksum + size。
3. **发布门槛 = 开放发布 + 先上后管**：任何登录用户可发布，提交即 `published`；靠事后举报/下架治理。
4. **归属 = 挂现有 cloud 账号**：`skills.owner_user_id` 引用 `users(id)`，复用现有 Bearer token 鉴权。

## 数据模型（v11 迁移）

取代当前 `skills` 单表，拆成列表 + 版本：

```sql
-- 列表项（一个 skill 一行）
CREATE TABLE skills (
  id             TEXT PRIMARY KEY,        -- slug，如 "weather-cn"（官方）或 "<owner>.<name>"（社区）
  owner_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_label    TEXT NOT NULL DEFAULT '',-- 展示用来源名（"Mia 官方" / 用户名）
  name           TEXT NOT NULL,
  category       TEXT NOT NULL DEFAULT 'uncategorized',
  description    TEXT NOT NULL DEFAULT '',
  latest_version TEXT NOT NULL DEFAULT '',-- 指向 skill_versions.version
  install_count  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'published', -- published | hidden | removed
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

-- 每个发布版本一行
CREATE TABLE skill_versions (
  skill_id     TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  version      TEXT NOT NULL,             -- semver
  package_path TEXT NOT NULL,             -- uploads/skills/<id>/<version>.zip（相对 dataDir）
  checksum     TEXT NOT NULL,             -- sha256(zip)
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  entry_path   TEXT NOT NULL DEFAULT 'SKILL.md', -- 包内入口
  manifest_json TEXT NOT NULL DEFAULT '{}',-- 文件清单等
  changelog    TEXT NOT NULL DEFAULT '',
  scan_status  TEXT NOT NULL DEFAULT 'unscanned', -- unscanned | clean | flagged
  created_at   TEXT NOT NULL,
  PRIMARY KEY (skill_id, version)
);

-- 安装账本（沿用，加记安装的版本）
CREATE TABLE skill_installs (
  skill_id        TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installed_version TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  PRIMARY KEY (skill_id, user_id)
);

-- 举报（先上后管）
CREATE TABLE skill_reports (
  id          TEXT PRIMARY KEY,
  skill_id    TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
```

**包存储**：`<dataDir>/uploads/skills/<id>/<version>.zip`（`uploads/` 已存在，用于图片）。`package_path` 存相对路径；下载校验 checksum。

## 发布协议（开放）

- `POST /api/skills` —— 建/更新列表项（owner = auth.user.id，owner_label = 用户名）。slug 冲突按 owner 命名空间化（`<owner>.<name>`，官方保留无前缀 slug）。
- `POST /api/skills/:id/versions` —— 上传一个打包 zip（multipart 或 base64），服务端校验 checksum、解析入口 SKILL.md frontmatter、写 `uploads/`、插 `skill_versions`、更新 `latest_version`，**status 直接 published**。仅 owner 可发版。
- `POST /api/skills/:id/report` —— 任何登录用户举报；攒够/人工处理后把 `skills.status` 置 `hidden`/`removed`。
- 列表/详情：`GET /api/skills`（已发布的）、`GET /api/skills/:id`（含最新版本元数据，不含 zip）、`GET /api/skills/:id/versions/:v/package`（下载 zip，带 checksum 头）。

## 安装协议（多文件）

- `POST /api/skills/:id/install` → 返回最新版本的下载信息（package URL + checksum + entry_path）+ 计数（按 user 去重，记 installed_version）。
- 桌面：下载 zip → 校验 checksum → **解压进 `<home>/skills/<id>/`**（多文件，沿用 slice-2 的私有源，可删）→ 记录已装版本。
- 更新：`GET /api/skills` 返回 `latest_version`；桌面比对本地已装版本（semver），有新版提示更新（重走安装覆盖）。

## 安全（先立钩子，不全做）

- `scan_status` 字段 + 一个扫描器 stub（对标 LobsterAI `skillSecurityScanner`）：发版时跑、可异步置 `flagged`。
- **桌面安装前必弹确认**：明示"该 skill 会执行代码、来源=<owner_label>、scan_status=<...>、未经审核"。先上后管下这是唯一的用户侧防线，**不能省**。
- 举报 + 下架链路（`skill_reports` + status）。

## 一方路径保留

`scripts/sync-cloud-skills.js` 升级：把 `skills/<id>/`（顶层，slice-3 已建）整个目录**打成 zip → 作为 version 发布**（owner = 官方账号，owner_label = "Mia 官方"）。你的 git 文件夹工作流不变，只是产出从"单 body upsert"变成"打包发版"。`skills/_builtin/` 仍只本地预装、不进市场。

## 迁移（v10 单表 → v11）

- 现有 `skills(单 body)` 表 → 新 `skills` + `skill_versions`：每条旧记录的 `body` 包成一个 `v1.0.0` 的单文件 zip，写 `uploads/`，建 version 行；owner = 官方账号。
- 现有 `skill_installs` 加 `installed_version`（默认空，向后兼容）。
- 迁移幂等、可重复跑。

## 切片（增量实现，各自可测可交付）

- **Slice F1 — schema + 打包/存储地基（纯 cloud）**：v11 迁移（4 表）、包存储 helper（写 zip 到 uploads + checksum）、`skills-store` 重写为 listing+versions、v10→v11 数据迁移。后端可测。
- **Slice F2 — 发布 + 安装协议（cloud）**：发布端点（zip 上传）、下载/install 端点、举报端点；`sync-cloud-skills.js` 升级成打包发版（一方）。后端可测。
- **Slice F3 — 桌面多文件安装**：preload/main 下载 zip→校验→解压进 `<home>/skills/<id>`；安装前确认弹窗；记录已装版本。
- **Slice F4 — 桌面发布 + 版本/更新 UI**：渲染层发布入口（把本地 skill 打包提交）、市场卡片显示版本/更新、"有更新"提示。
- **Slice F5 — 安全治理**：扫描器 hook 落地、举报 UI、下架流程。

先做 F1（schema + 打包地基），它是其余一切的底座，且和现有单表迁移绑定。

## 验证基线

每个 slice：`npm test`（新增对应单测）+ `npm run check` 绿；cloud 端点走 `tests/cloud-*-api.test.js` 起真服务测；桌面侧走源断言 + 手动 `npm start`。
