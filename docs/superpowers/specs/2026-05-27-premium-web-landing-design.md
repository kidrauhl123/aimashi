# Premium Web Landing Design Spec

## Goal

Rebuild the public Mia marketing page into a premium, product-led landing page for `https://aiweb.buytb01.com/` while preserving the existing static web deployment and `/app/` product shell.

## Scope

- Public root page: `src/web/index.html`.
- New landing-only assets: `src/web/landing.css` and `src/web/landing.js`.
- Release verification: `scripts/build-cloud-release.js`.
- Regression coverage: `tests/web-landing.test.js`.

The `/app/` web client remains under `src/web/app/index.html` and must keep using parent-relative product assets.

## Design Direction

Mia should feel like a serious agent-era workspace, not a generic SaaS template. The page uses a high-contrast editorial/product system:

- Graphite background for authority and contrast.
- Porcelain surfaces for product UI previews.
- Electric amber and mint accents for agent routing state.
- Precise grid, rails, console surfaces, and sharp panels instead of soft marketing cards.
- Native product mockups rather than stock imagery.
- Scroll-driven stage changes that make the page feel alive without requiring external animation libraries.

## Information Architecture

1. Hero: strong product name, direct Chinese value proposition, download CTA, `/app/` CTA, product mockup.
2. Scroll story: four-stage sticky explanation of selecting a Fellow, routing work, approving tools, and syncing replies.
3. System section: local desktop bridge, cloud rooms, permissions, engines, skills, pets, and memory.
4. Trust section: clear explanation of what runs locally, what syncs through cloud, and where authority stays.
5. Download section: Apple Silicon available, Intel and Windows marked coming soon, Mia Web entry retained.

## Motion Requirements

- `requestAnimationFrame` scroll progress updates CSS variable `--landing-scroll`.
- `IntersectionObserver` activates scroll-story steps.
- Pointer movement updates `--pointer-x` and `--pointer-y` for subtle product mockup parallax.
- `prefers-reduced-motion` disables transform-heavy effects.

## Deployment Constraints

- No new framework.
- No CDN dependency.
- No build step required for the landing itself.
- Release builder must copy and assert `web/landing.css` and `web/landing.js`.

## Acceptance Criteria

- The public root has `data-page="landing"`.
- The page links `./landing.css` and `./landing.js`.
- Download link remains `/downloads/mia-macos-arm64-latest.dmg`.
- `/app/` CTA remains visible.
- The page includes scroll progress, stage data attributes, requestAnimationFrame, IntersectionObserver, and reduced-motion handling.
- `node --test tests/web-landing.test.js` passes.
- `node --check src/web/landing.js` passes.
