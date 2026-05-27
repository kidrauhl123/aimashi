# Web Landing Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public Mia landing page at `/` with a real macOS Apple Silicon download and move Mia Web to `/app/`.

**Architecture:** `src/web/index.html` becomes a static marketing/download page. The current chat SPA shell moves to `src/web/app/index.html` and keeps using root-level `app.js`, `styles.css`, shared modules, and assets through parent-relative URLs. The release builder optionally copies the locally built arm64 DMG into the Web release downloads directory.

**Tech Stack:** Static HTML/CSS/JS served by `scripts/serve-cloud.js`, Electron builder DMG output, Node test runner.

---

### Task 1: Route Contract Tests

**Files:**
- Create: `tests/web-landing.test.js`
- Modify: `tests/web-unread-routing.test.js`

- [ ] **Step 1: Write failing landing route tests**

Add `tests/web-landing.test.js` with tests asserting that:
- `src/web/index.html` is the landing page and links to `/app/`.
- The landing primary download points to `/downloads/mia-macos-arm64-latest.dmg`.
- Intel and Windows are marked `即将支持`.
- `src/web/app/index.html` exists and contains the Web app shell.
- The release builder contains logic for `mia-macos-arm64-latest.dmg`.

- [ ] **Step 2: Run the new test**

Run: `node --test tests/web-landing.test.js`

Expected now: FAIL because the landing page and `/app/` shell do not exist yet.

### Task 2: Web App Shell Move

**Files:**
- Create: `src/web/app/index.html`
- Modify: `src/web/index.html`
- Modify: `tests/web-unread-routing.test.js`

- [ ] **Step 1: Copy the current app shell**

Copy the current Web app HTML into `src/web/app/index.html`.

- [ ] **Step 2: Adjust app shell asset URLs**

Change app shell asset URLs from `./...` to `../...` where needed:
- `../styles.css`
- `../favicon.svg`
- `../apple-touch-icon.png`
- `../manifest.webmanifest`
- `../shared/...`
- `../helpers/...`
- `../message-sources/...`
- `../appearance.js`
- `../app.js`

- [ ] **Step 3: Update existing Web app tests**

In `tests/web-unread-routing.test.js`, point app-shell HTML assertions to `src/web/app/index.html` instead of `src/web/index.html`.

### Task 3: Landing Page

**Files:**
- Modify: `src/web/index.html`
- Modify: `src/web/styles.css`

- [ ] **Step 1: Replace root HTML with landing shell**

Create a static landing page with:
- top nav: Mia logo, Product, Download, `打开 Mia Web`.
- hero H1: `Mia`
- supporting copy explaining AI Fellows and multi-device use.
- primary download CTA: `/downloads/mia-macos-arm64-latest.dmg`.
- secondary CTA: `/app/`.
- app-preview visual matching the approved A direction.
- download cards for Apple Silicon available, Intel coming soon, Windows coming soon.

- [ ] **Step 2: Add landing styles**

Append focused `.landing-*` CSS to `src/web/styles.css`, keeping it scoped so the Web app is not affected.

### Task 4: Release Download Artifact

**Files:**
- Modify: `scripts/build-cloud-release.js`
- Test: `tests/web-landing.test.js`

- [ ] **Step 1: Add optional DMG copy helper**

Add a helper that finds the newest `release/Mia-*-arm64-unsigned.dmg` and copies it to `dist/mia-cloud-release/web/downloads/mia-macos-arm64-latest.dmg` when present.

- [ ] **Step 2: Keep release build working without a DMG**

If no DMG exists, create the `downloads` directory but do not fail the cloud release build.

### Task 5: Verification and Deployment

**Files:**
- No source files unless tests reveal a defect.

- [ ] **Step 1: Run targeted tests**

Run:
- `node --test tests/web-landing.test.js tests/web-unread-routing.test.js`
- `node --check src/web/app.js`
- `npm run check`

- [ ] **Step 2: Build desktop DMG**

Run: `npm run dist:mac`

Expected: `release/Mia-0.1.0-arm64-unsigned.dmg` exists on this arm64 Mac.

- [ ] **Step 3: Build cloud release**

Run: `npm run cloud:release`

Expected: `dist/mia-cloud-release/web/downloads/mia-macos-arm64-latest.dmg` exists if the DMG build succeeded.

- [ ] **Step 4: Render-test local release**

Serve the built Web release with Cloud locally, verify:
- `/` shows the landing page and download cards.
- `/app/` shows the Mia Web login.
- `/downloads/mia-macos-arm64-latest.dmg` returns the DMG.

- [ ] **Step 5: Deploy only Web static assets**

Back up `/var/www/mia-web`, then sync `dist/mia-cloud-release/web/` to `/var/www/mia-web/`.

- [ ] **Step 6: Verify production**

Verify:
- `https://aiweb.buytb01.com/` is the landing page.
- `https://aiweb.buytb01.com/app/` is Mia Web.
- `https://aiweb.buytb01.com/downloads/mia-macos-arm64-latest.dmg` returns HTTP 200.
- `mia-cloud` systemd `MainPID` and `ActiveEnterTimestamp` are unchanged.
