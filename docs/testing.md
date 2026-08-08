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
| `pnpm test:db` | `src/electron/db` (Node ABI for `better-sqlite3`). |
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
- Harness: `src/test/mocks/preload.ts` (`onInvoke`, `stubFs` / `createTestFs`), `renderWithProviders`, `fixtures/libraryItem.ts`
- E2E: [`e2e/`](../e2e/), [`playwright.config.ts`](../playwright.config.ts)

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
