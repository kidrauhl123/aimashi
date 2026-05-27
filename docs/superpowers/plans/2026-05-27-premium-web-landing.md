# Premium Web Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Mia public marketing page into a premium product-led landing page while keeping the existing static deployment and `/app/` web shell intact.

**Architecture:** Keep `src/web/index.html` as the public entry point, move landing-specific styling and behavior into `landing.css` and `landing.js`, and leave the app shell under `src/web/app/`. The release builder already copies `src/web`, so the only release change is asserting the new landing assets.

**Tech Stack:** Static HTML, CSS custom properties, vanilla JavaScript, Node test runner.

---

## File Structure

- Create: `src/web/landing.css` - landing-only design system, responsive layout, product mockup, scroll story, reduced-motion rules.
- Create: `src/web/landing.js` - scroll progress, active story stage, pointer parallax, reveal states.
- Modify: `src/web/index.html` - semantic landing markup and product copy.
- Modify: `scripts/build-cloud-release.js` - release required-file assertions for landing assets.
- Modify: `tests/web-landing.test.js` - regression coverage for the redesigned static landing.

## Tasks

### Task 1: Landing Markup

- [x] Replace inline landing CSS and inline script in `src/web/index.html` with external `./landing.css` and `./landing.js`.
- [x] Preserve `data-page="landing"`, download link `/downloads/mia-macos-arm64-latest.dmg`, and `/app/` entry.
- [x] Add product-led sections: hero, scroll story, system, trust, download.

### Task 2: Landing Design System

- [x] Add `src/web/landing.css`.
- [x] Define landing-only tokens for graphite, porcelain, amber, mint, borders, and motion.
- [x] Implement desktop and mobile layouts with stable dimensions and no viewport-scaled font sizing.
- [x] Add reduced-motion handling and visible focus states.

### Task 3: Landing Motion

- [x] Add `src/web/landing.js`.
- [x] Use `requestAnimationFrame` to update `--landing-scroll`.
- [x] Use `IntersectionObserver` for stage and reveal states.
- [x] Use pointer variables for subtle mockup parallax and disable it when reduced motion is requested.

### Task 4: Release And Tests

- [x] Add `web/landing.css` and `web/landing.js` to release verification.
- [x] Update `tests/web-landing.test.js` to assert the new page structure and assets.
- [ ] Run `node --check src/web/landing.js`.
- [ ] Run `node --test tests/web-landing.test.js tests/web-unread-routing.test.js`.

### Task 5: Visual And Deploy Verification

- [ ] Serve or inspect the page locally.
- [ ] Verify desktop and mobile layout do not clip key content.
- [ ] Build/release if needed.
- [ ] Deploy the updated static web assets to the server if local checks pass.
