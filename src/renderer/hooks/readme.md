# Hooks

Window command matching lives in [`src/renderer/features/keybindings/`](../features/keybindings/README.md): one runtime per renderer, `useCommandOwner` at the feature that owns the state, and `KeybindingProvider` for ingress.

Specialized home/list hooks:

- [`useCycleShortcutGroups.ts`](useCycleShortcutGroups.ts) — first/second bar cycle commands
- [`useSelectionShortcuts.ts`](useSelectionShortcuts.ts) — select-all / delete / Escape-clear for a visible list
- [`usePageSearchFocus.ts`](usePageSearchFocus.ts) — `focusPageSearch` owner for a search field
