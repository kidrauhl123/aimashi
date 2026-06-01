# Mobile 自更新设计 · Web OTA + APK 自更新

日期:2026-06-01
状态:设计待确认
依赖:`2026-06-01-mobile-view-design.md`(独立 mobile 视图 + Capacitor 壳已实现)

## 目标

装一次 APK 之后,日常迭代自动到手机,不再手动转发。分两层:

1. **Web OTA(热更新)** —— 换壳内 web 包(`dist/mobile-www`),覆盖 99% 改动(聊天/权限/trace/样式/逻辑)。无需重装。
2. **APK 自更新(整包)** —— 仅在改原生壳(加插件/权限/`capacitor.config`)时,app 内提示下载新 APK 并拉起安装。

两者产物全部托管在自己的服务器 `aiweb.buytb01.com`,不依赖任何付费服务(不用 Ionic Appflow)。

## 现状底座(已验证)

- 服务器 web 静态:`/var/www/mia-web`,nginx(`/etc/nginx/sites-enabled/mia-web`)。
- 下载文件惯例:`webDir/downloads/`(DMG 走这里,`/downloads/...` 提供),由 `scripts/build-cloud-release.js` 组装进 release 的 webDir,`npm run cloud:deploy` 发布。
- 因此 OTA 产物挂在 `webDir/mobile-ota/`(+ APK 复用 `webDir/downloads/`),顺现有 nginx 静态 + 现有部署管线走,**生产服务器零新增服务**。
- 生产域名 `https://aiweb.buytb01.com`,`/api/health` 正常。

## 版本号单一来源

仓库新增 `mobile-version.json`:
```json
{ "web": 1, "native": 1 }
```
- `web`:web 包版本,每次发 OTA 自增。
- `native`:原生壳版本,== `android/app/build.gradle` 的 `versionCode`;改原生时手动 +1 并重建 APK。
构建脚本读写此文件,避免多处漂移。

## 服务器清单(静态文件,全在 webDir 下)

```
/var/www/mia-web/
  mobile-ota/
    latest.json                 ← web 包清单
    native.json                 ← 原生 APK 清单
    mobile-web-<web>.zip         ← web 包(dist/mobile-www 的 zip)
  downloads/
    mia-android-latest.apk       ← 最新 APK(原生自更新用)
```

`latest.json`:
```json
{ "web": 3, "url": "https://aiweb.buytb01.com/mobile-ota/mobile-web-3.zip",
  "sha256": "<hex>", "minNative": 1, "notes": "..." }
```
- `minNative`:此 web 包要求的最低原生版本。若设备 `versionCode < minNative`,**不应用 web 包,改走 APK 更新**(防止新 web 调用了旧壳没有的原生能力)。

`native.json`:
```json
{ "versionCode": 2, "versionName": "1.1",
  "url": "https://aiweb.buytb01.com/downloads/mia-android-latest.apk", "notes": "..." }
```

## 第 1 层:Web OTA

**插件**:`@capgo/capacitor-updater`(开源,自托管,只用其"下载+切换 bundle+回滚"能力;版本检查我们自己写,全指向自己服务器)。

**app 启动 / 从后台恢复时**(`src/mobile/lib/ota-web.js`,纯逻辑可单测,DOM/插件薄包在 app.js):
1. fetch `mobile-ota/latest.json`(带 cache-bust query)。
2. 比较:
   - `latest.web <= 当前 web` → 无操作。
   - `latest.minNative > 设备 versionCode` → 触发第 2 层(APK 更新),不下 web 包。
   - 否则 → `CapacitorUpdater.download({ url, version, checksum: sha256 })`。
3. 下载成功 → `CapacitorUpdater.set(bundle)`,在**下次冷启动 / 下次切回前台**生效(不打断当前会话)。默认:下载完静默就绪,下次进 app 即新版本;可选弹"有新版,点此立即重启"。
4. 启动后 web 正常跑起来 → 调 `CapacitorUpdater.notifyAppReady()`。**若超时未调用(新包崩在启动)→ Capgo 自动回滚到上一个好包**。

**纯逻辑边界**(`ota-web.js`,可单测):`shouldUpdateWeb({ latest, currentWeb, deviceNative })` → 返回 `"web" | "native" | "none"`;以及 manifest 校验、sha256 比对入口。下载/set/notifyReady 这些副作用由 app.js 调插件。

## 第 2 层:APK 自更新(仅 Android)

**app 启动时**:fetch `mobile-ota/native.json`;若 `native.versionCode > 设备 versionCode`,弹"有新版本需要更新" → 下载 APK → 拉起系统安装界面。用户点一次"更新"(安卓侧载安全限制,无法全自动)。

**实现**:
- 下载:`@capacitor/filesystem` 写入应用缓存目录。
- 安装:新增最小自写 Capacitor 插件 `android/.../ApkInstaller`(Kotlin,约 30 行):用 `FileProvider` 生成 content URI,启动 `ACTION_VIEW`(`application/vnd.android.package-archive`)/ `Intent.ACTION_INSTALL_PACKAGE`。
- 权限:`AndroidManifest.xml` 加 `REQUEST_INSTALL_PACKAGES`;配 `FileProvider`(`<provider>` + `file_paths.xml`)。
- 纯逻辑边界(`ota-native.js`,可单测):`shouldUpdateNative({ native, deviceNative })` → bool。

**签名一致性(关键)**:安卓拒绝用不同签名证书覆盖安装。debug 包用本机稳定的 debug keystore,重建可互相覆盖;一旦换 release keystore,首次切换需卸载重装。**结论**:现在就固定一套签名 keystore(先沿用 debug;转正式发布前确立 release keystore 并锁定),否则自更新会在切签名时断链。

**iOS**:不适用(侧载 APK 是安卓专属)。iOS 将来只能 web-OTA + TestFlight/正式发布走原生,本 spec 不覆盖 iOS。

## 构建 / 发布

新增 `scripts/build-mobile-ota.js`:
1. `node scripts/build-mobile-www.js`(产 `dist/mobile-www`)。
2. 读 `mobile-version.json`,把 `web` 写进 `dist/mobile-www/ota-version.json`(app 读它得知"当前 web 版本")。
3. zip → `mobile-web-<web>.zip`,算 sha256。
4. 写 `latest.json`(web、url、sha256、minNative)。
5. 把 zip + latest.json 放进 cloud release 的 `webDir/mobile-ota/`;APK 放 `webDir/downloads/mia-android-latest.apk`、写 `native.json`。

接进 `build-cloud-release.js`(与 DMG 同一组装点),随 `npm run cloud:deploy` 发布。npm scripts:
```
"mobile:ota:build": "node scripts/build-mobile-ota.js",
"mobile:ota:bump:web": "node scripts/bump-mobile-version.js web",
"mobile:ota:bump:native": "node scripts/bump-mobile-version.js native"
```

## 测试

- 纯逻辑单测:`shouldUpdateWeb`(各分支:无更新 / web 更新 / 需原生 / 版本相等边界)、`shouldUpdateNative`、manifest 解析与 sha256 校验入口。
- 构建脚本:跑 `mobile:ota:build`,断言产出 zip + 两个 json + sha256 与文件一致、`ota-version.json` 写入 zip。
- 真机手验:① 改一行 web,bump web,deploy → 手机重开自动到新版;② 故意发坏包验自动回滚;③ bump native + 新 APK,验 app 内下载+安装。

## 明确不在本 spec

- 推送(APNs/FCM)—— 另有 spec。
- iOS 的原生更新通道。
- 灰度 / 分批发布、A/B —— 先全量。
- 后台静默下载的精细策略(先简单:启动+恢复时检查)。
