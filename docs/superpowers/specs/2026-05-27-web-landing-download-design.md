# Web Landing Download Design

## Goal

Turn the public Web root (`/`) into a product landing page with a real macOS Apple Silicon desktop download. Move the existing Mia Web chat application to `/app/`.

## User Experience

- `/` is a polished landing page in the approved "product app preview" direction.
- Primary CTA downloads the macOS Apple Silicon build at `/downloads/mia-macos-arm64-latest.dmg`.
- Secondary CTA opens the existing Web app at `/app/`.
- Download availability shows:
  - macOS Apple Silicon: available, beta.
  - macOS Intel: coming soon.
  - Windows: coming soon.
- The first viewport must make Mia and the desktop product obvious, with a visible hint of the next content band.

## Architecture

- Keep the landing page static and independent from the chat SPA.
- Preserve the existing Web app HTML by moving it to `src/web/app/index.html` with asset URLs adjusted to parent-relative paths.
- Keep existing JS/CSS assets at `src/web/app.js`, `src/web/styles.css`, and shared asset directories.
- Extend the cloud release builder to copy an optional local desktop DMG from `release/Mia-*-arm64-unsigned.dmg` into `dist/mia-cloud-release/web/downloads/mia-macos-arm64-latest.dmg`.
- Do not commit DMG files into Git.

## Deployment

- Build the landing/Web release.
- Build or provide the macOS Apple Silicon DMG.
- Deploy only Web static assets when the API does not need changes.
- Verify `/`, `/app/`, and `/downloads/mia-macos-arm64-latest.dmg` over HTTPS.
