# AGENTS.md

This file is the working guide for coding agents in this repository. Follow it for every change unless the
user gives more specific instructions.

## Project overview

LoL Profile Manager is a Windows x64 Electron application that previews and applies League Client social
profile appearance changes. It uses React, TypeScript, Mantine, Zustand, i18next, CommunityDragon, and the
local League Client Update (LCU) API.

Repository: `https://github.com/duyanhdo10/lol-profile-manager`

## Product invariants

- Preserve preview, review, ordered apply, rollback, ownership, and patch-compatibility behavior.
- Never imply that the app grants ownership or changes gameplay progression.
- Never automatically reapply profile changes after a League Client reconnect.
- Keep LCU credentials, filesystem access, and remote network access in the Electron main process.
- Do not expose raw Electron or LCU errors in the UI. Use stable error codes and translated descriptions.
- Keep the renderer sandboxed and communicate only through the typed preload bridge.

## Repository map

- `electron/main.ts`: composition root and secure BrowserWindow configuration.
- `electron/lcu-client.ts`: League Client discovery, connection monitoring, and transport.
- `electron/catalog-service.ts`: CommunityDragon download, normalization, localization, and cache.
- `electron/apply-service.ts`: transaction preview, ordered apply, and rollback.
- `electron/ipc-registration.ts`: IPC registration and error normalization.
- `src/shared/models/`: contracts shared by main, preload, renderer, and tests.
- `src/renderer/app/`: router, application layout, and Mantine theme.
- `src/renderer/features/settings/`: locale preference, i18next resources, and language UI.
- `src/renderer/store/`: lifecycle, session, catalog, draft, and apply state.
- `src/renderer/pages/`: profile editing screens.
- `tests/unit`, `tests/integration`, `tests/renderer`, `tests/e2e`: test suites by layer.

## Development environment

- Supported development runtime: Node.js `24.18.x`, npm `11` or newer.
- This repository is primarily developed on Windows with PowerShell.
- If PowerShell blocks `npm.ps1`, run `npm.cmd`, for example `npm.cmd run verify`. Do not weaken the
  machine's execution policy.
- Use `npm ci` for a clean dependency install. Do not update dependencies unless the task requires it.

## Implementation conventions

- Keep TypeScript strict and use shared domain models instead of duplicating IPC payload shapes.
- Prefer feature-oriented modules and small components over adding more responsibilities to large files.
- Use Mantine for accessible primitives and simple layout; use CSS Modules for custom layout and states.
- Put static styling in the theme or CSS Modules. Inline styles are allowed only for typed runtime CSS
  variables or virtualizer measurements.
- Do not hardcode user-facing strings in JSX or services. Add both English and Vietnamese translations in
  `src/renderer/features/settings/i18n/resources.ts`.
- Supported application locales are `en_US` and `vi_VN`; unsupported locales fall back to English.
- Preserve drafts by stable catalog IDs when switching locale.
- Keep image assets on CommunityDragon `global/default`; Vietnamese metadata comes from `global/vi_vn`
  with per-file fallback to default.
- Treat catalog loading as cache-first. Network failures must not block use of a valid cache.

## Branding and logo

- `src/assets/logo.png` is the single source of truth for the application logo.
- The renderer navbar, fallback profile image, HTML favicon, Electron window, and electron-builder config must
  continue to reference that file (directly or through Vite's generated asset).
- Do not restore the old `LPM` text mark or show a hardcoded version/catalog badge in the navigation/header.
- After changing the logo, always rebuild the renderer and installer. A source commit alone does not update a
  previously generated `.exe`.
- Verify that the Vite-generated `dist/renderer/assets/logo-*.png` hash matches `src/assets/logo.png` before
  publishing the installer.

## Required verification

Use the smallest relevant checks while iterating. Before handing off a normal code change, run:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run lint:css
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

`npm.cmd run verify` runs the same main verification pipeline. Also run `npm.cmd run test:e2e` for lifecycle,
IPC, packaging-sensitive, or broad UI changes. Run `npm.cmd run package` for branding, Electron metadata,
installer, or release work.

Do not claim a check passed unless it was actually run. Report any check that could not run and why.

## Packaging and release workflow

1. Develop each feature on a dedicated branch such as `feat/auto-update`; keep conventional commits focused.
2. Update the version in both `package.json` and `package-lock.json` and add bilingual notes at
   `release-notes/v<version>.md`.
3. Run `npm.cmd run verify`, `npm.cmd run test:e2e`, and `npm.cmd run package`.
4. Confirm the installer, `latest.yml`, and `.exe.blockmap` in `release/` have the expected version and new
   timestamps.
5. Confirm the bundled logo hash matches the source logo and translated resources exist in the production
   bundle.
6. Merge the feature branch back with `--no-ff` so its focused commits remain visible, then push the source.
7. Tag the merge/release commit with `v<version>` and push the tag. The tag-triggered Release workflow verifies,
   builds, uploads to a draft, validates update artifacts, and publishes an official/latest GitHub Release.
8. Confirm GitHub lists the installer, `latest.yml`, and `.exe.blockmap` with names matching the metadata.

The generated `release/`, `dist/`, and `dist-electron/` contents are build outputs and must not be committed.
Never replace an asset from an existing release. Installed versions starting at v0.1.0-beta.3 discover future
releases through `electron-updater` starting with v0.1.0-beta.4; earlier versions require one manual installer
upgrade.

The updater is enabled only in packaged builds and can be disabled with `LPM_DISABLE_UPDATER=1` for E2E. It
downloads automatically but must keep `autoInstallOnAppQuit` disabled and install only after explicit user
confirmation. Do not add a GitHub token to the application. Beta installers are currently unsigned; retain the
SHA-512 update metadata and document the SmartScreen limitation until code signing is introduced.

## Git and change safety

- Start each independent feature from an updated `main` on its own `feat/*`, `fix/*`, or `docs/*` branch.
- Prefer conventional commit subjects and merge completed feature branches into `main` with `--no-ff`.
- Preserve unrelated user changes in a dirty worktree.
- Do not use destructive Git commands such as `git reset --hard` or discard files without explicit approval.
- Keep commits focused and use clear conventional-style messages where practical.
- Do not push, tag, publish a release, or change GitHub repository settings unless the user explicitly asks.
- Never print, store, or commit GitHub/LCU credentials or access tokens.
