# Keybindings runtime (renderer)

Window-local command runtime: one instance per renderer, owner registration, and a single keyboard/pointer ingress. Persistence lives in main (`keymapFileStore`); this folder does not write `shortcuts.json`.

The old matcher (`keyFormatter` + per-surface `keys.includes`) is gone. Feature owners register through {@link useCommandOwner}; Settings edits go through `keymap:edit`. Adding a catalog command is documented in [`src/common/keybindings/README.md`](../../common/keybindings/README.md).

## Shape

| Module | Responsibility |
| --- | --- |
| `runtime.ts` | Owners, compile, resolve, held sessions, UI lock, recorder (`beginRecording` / `onCancel`), Escape. Search-widget owners are eligible only when they own the event target, including when nested in a menu/modal/settings overlay without `parentOwnerId`. Same-context owners with a handler win over claimants that only share the context. While recording, Space/Enter are captured even if the event target is a native button. |
| `target.ts` | Live-trigger normalization (named-key fallback when `code` is Unidentified), shown-element and list-widget ownership checks, and native/IME/typing classification |
| `KeybindingProvider.tsx` | Mounts ingress once; publishes the runtime |
| `useCommandOwner.ts` | Register/update/cleanup without stale handler closures; `useOwnerId` for per-mount ids (runtime React has no `useId`) |

Ingress uses physical `KeyboardEvent.code` positions (US-named). Layouts that type different characters on those positions still match catalog defaults. Historical imported `logicalKey` rows match `KeyboardEvent.key` instead. Chromium often reports the application Menu key as `key: ContextMenu` with `code: Unidentified`; that is mapped to the catalog `ContextMenu` code and is not recorded as Unidentified.

Feature adapters (App, lists, readers) live next to the state they operate on and call {@link useCommandOwner}.

Enter / Shift+Enter / Space on chrome (submit, click, toggle a non-button) use `onWidgetActivateKey` / `clickOnWidgetActivateKey` in `src/renderer/utils/keyboard.ts`. Those keys are not catalog commands.

## Verify

```powershell
pnpm test:unit src/renderer/features/keybindings
pnpm test:unit src/renderer/features/settings/components/Shortcuts.test.tsx
```
