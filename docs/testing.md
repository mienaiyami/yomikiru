# Testing

Vitest + Testing Library for unit/RTL (beside Forge/Webpack). Playwright `_electron` for smoke.

## Install

```powershell
pnpm install
pnpm rebuild:electron   # after install / after test:db, before pnpm dev
```

## Commands

| Script | What |
| -------- | ------ |
| `pnpm test` / `pnpm test:unit` | Renderer/common unit + RTL (jsdom). No native ABI. |
| `pnpm test:db` | `src/electron/db` and `src/electron/util` (Node; mock or ABI-matched `better-sqlite3`). |
| `pnpm test:all` | Unit + db. |
| `pnpm test:watch` | Watch unit project. |
| `pnpm test:coverage` | Unit coverage. |
| `pnpm test:coverage:all` | Unit + db coverage (CI). |
| `pnpm test:e2e` | Electron smoke (needs `.webpack/main`). |

### `better-sqlite3` ABI (local)

```powershell
pnpm rebuild:node       # before test:db / test:all / test:coverage:all
pnpm rebuild:electron   # before pnpm dev again
```

CI uses system Node, so db tests need no rebuild there.

## Layout

- Co-located: `foo.ts` -> `foo.test.ts` / `.tsx`
- [`vitest.config.mts`](../vitest.config.mts) — aliases from [`tsconfig.json`](../tsconfig.json) `paths`
- Projects: **unit** (jsdom + `src/test/setup.ts`), **db** (node)
- Harness: `src/test/mocks/preload.ts` (`onInvoke`, `stubFs` / `createTestFs`), `renderWithProviders` (Redux + i18n), `renderWithI18n` (i18n only), `fixtures/libraryItem.ts`. Unit `setup.ts` calls `initRendererI18n` once; do not re-init i18next in individual tests.
- App `tsconfig.json` excludes `src/test` and `*.test.ts(x)` so Forge/`pnpm dev` (ts-loader typechecks that project) does not typecheck tests. Webpack `ts-loader` `exclude` also skips those paths (plus `.webpack` / `e2e`) so an accidental import cannot pack them. Vitest still compiles them. Do not set ts-loader `onlyCompileBundledFiles` - it drops ambient `.d.ts` and floods the overlay.
- E2E: [`e2e/`](../e2e/), [`playwright.config.ts`](../playwright.config.ts)

## Prefer Vitest flow tests (dialogs / IPC glue)

For recovery flows that combine `stubFs` + native dialogs + IPC/callbacks (missing library path, locate chapter, relocate, bookmark rewrite), add **co-located Vitest flow tests** that stub `dialog:*` via `onInvoke` and assert the composed result. Prefer that over Playwright e2e (native folder pickers are awkward; `e2e/` stays smoke). Persist FK/bookmark updates with `pnpm test:db`. See `.cursor/rules/testing.mdc`.

## Cross-platform paths

Use `path.join` / `window.path.join`. See `.cursor/rules/testing.mdc`.

## Coverage

Scope and thresholds: `vitest.config.mts`. Prefer behavior tests over chasing %.

## Playwright smoke

Asserts `.homeContainer` is visible. Not in CI yet.

```powershell
pnpm package
pnpm test:e2e
```
