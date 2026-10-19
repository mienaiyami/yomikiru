# Keybindings (pure model)

Process-agnostic catalog, binding schema, keymap compile/resolve, conflict diagnostics, ingest of persisted shortcut files, and pure typed edits. No DOM, React, Node `fs`, or Electron.

The durable file owner is `src/electron/util/keymapFileStore.ts` (process singleton). Renderers hydrate and edit through `keymap:get` / `keymap:edit`; they must not write `shortcuts.json` via `saveJSONfile` or `fs:saveFile`. Window-local runtime and owner registration live in [`src/renderer/features/keybindings/`](../../renderer/features/keybindings/README.md). Behavior is specified in [docs/keybinding-refactor-spec.md](../../../docs/keybinding-refactor-spec.md).

Feature code should import from `@common/keybindings`, not from individual files. Ingest-only helpers live in `legacy.ts` and are not on the barrel.

## Shape

| Module | Responsibility |
| --- | --- |
| `catalog.ts` | Command ids (`CommandId` = `shortcutNames` keys), defaults, contexts, invocation/input policy |
| `types.ts` | Triggers, modifiers, envelope, schema version |
| `binding.ts` | Parse physical combos, match, overlap, display and menu-accelerator labels |
| `contexts.ts` | Specificity, coexistence, representative stacks, Settings overlap notes |
| `keymap.ts` | Compile defaults+overrides; pick at most one candidate |
| `diagnostics.ts` | Derived conflict/info rows (never persisted) |
| `edit.ts` | Typed add/remove/reset ops with stale-command and revision checks |
| `migrate.ts` | On-disk JSON -> `KeymapDocument` |
| `legacy.ts` | **COMPAT** - old `keys` / `key1`/`key2` parse and one-shot catalog splits. Remove with `LogicalKeyTrigger` when those files are gone. |

## Overrides and `schemaVersion`

Missing command key: inherit catalog defaults (platform-aware). Empty array: deliberately unbound.

`KEYMAP_SCHEMA_VERSION` is the envelope this build **writes**. It is not a command catalog version.

- **Same version, new optional JSON field:** keep the number; old builds ignore the field.
- **Shape old builds cannot read:** bump the number and teach `ingestPersistedKeymap` to read the previous envelope. Files with a *greater* version stay read-only (`unsupportedVersion`); do not rewrite them.
- **No bump** for a new catalog command: defaults live in `catalog.ts`. Existing `overrides` rows are unchanged. Users without an override inherit the new default.

Older arrays (`{ command, keys }` or `{ command, key1, key2 }`) have no `schemaVersion`. Ingest upgrades them to the current envelope; the file owner then rewrites `shortcuts.json`.

## Adding a command

1. Add `shortcutNames.<id>` in `src/common/i18n/locales/en/reader.json` (this is `CommandId`).
2. Add a `COMMAND_CATALOG` draft in `catalog.ts`: `group`, `defaultBindings` (`kbd` / `ptr`), `contextKinds`, optional `inputPolicy` / `invocation` / darwin defaults. `labelKey` and `tieOrder` are derived. Settings search uses `shortcut:<id>` from the command id.
3. Register a handler on the owner that claims those contexts (`useCommandOwner` / `useAppCommandOwner` / reader adapters). A catalog row with no handler is unavailable, not a fallthrough.
4. Settings search picks up `#settings-shortcut-<id>` from the catalog. Usage copy only if users need a prose explanation (`Usage.tsx` + settings catalog rules).
5. Run `pnpm test:unit src/common/keybindings` and `pnpm tslint`.

Do not add a parallel id list, a second matcher, or a `keys.includes` check in a feature.

## Layouts

Catalog defaults and the recorder store physical `KeyboardEvent.code` positions (US-named: `KeyA` is the leftmost home-row letter key). On AZERTY that key types `q`; the binding still fires. Punctuation that lives on a different physical key (for example `/` on some layouts) will not match a `Slash` binding unless the user re-records it.

Historical `key1`/`key2` imports stay `logicalKey` and match `KeyboardEvent.key` (the character produced). They are not rewritten to physical codes.

## Verify

```powershell
pnpm test:unit src/common/keybindings
pnpm test:unit src/renderer/store/shortcuts.test.ts
pnpm test:db src/electron/util/keymapFileStore.test.ts
pnpm tslint
```
