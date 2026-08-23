# Creating Overlays in Electron

In an Electron environment, native browser APIs like `window.prompt()` and `window.confirm()` are not reliable. Use form-based inputs and overlays instead.

## Overlay Patterns

The app uses a consistent overlay structure with `clickClose` and `overlayCont` (or `modal-overlayCont` for modals). These patterns are defined in styles and mixins.

### Structure

```
<div id="myOverlay" data-state="closed">
  <div className="clickClose" onClick={onClose} />
  <div className="overlayCont" tabIndex={-1} onKeyDown={...}>
    {/* Content */}
  </div>
</div>
```

- **clickClose**: Full-size backdrop that closes the overlay when clicked. Styled by `mixins.contFadeScaleIn`.
- **overlayCont**: The visible content panel. Receives focus for keyboard handling (e.g. Escape to close).

### Mixin: contFadeScaleIn

From `src/renderer/styles/mini/_mixins.scss`:

- `.clickClose`: Positioned absolutely, full size, semi-transparent background
- `data-state="open"`: Content visible, scale 1
- `data-state="closed"`: Content hidden, scale 1.1 with transition

Apply via `@include mixins.contFadeScaleIn(".overlayCont")` (or `.modal-overlayCont` for modals).

### Open Animation

Set `data-state="closed"` initially, then switch to `"open"` after mount:

```tsx
ref={(node) => {
    if (node) {
        setTimeout(() => {
            if (node) node.setAttribute("data-state", "open");
        }, 100);
    }
}}
```

## Examples

| Component | Path | Notes |
|-----------|------|-------|
| AnilistSearch | `src/renderer/features/anilist/AnilistSearch.tsx` | Search overlay, input, results list |
| AniLogin | `src/renderer/features/anilist/AniLogin.tsx` | Input for token, proceed/submit flow |
| AnilistEdit | `src/renderer/features/anilist/AnilistEdit.tsx` | Form overlay with multiple inputs |
| Settings | `src/renderer/features/settings/Settings.tsx` | Uses `overlayCont settingCont` |
| Modal | `src/renderer/components/ui/Modal.tsx` | Reusable modal with `modal-overlayCont` |
| UiBlockOverlay | `src/renderer/components/UiBlockOverlay.tsx` | Non-dismissible full-window lock |

## UI lock (`blockUi`)

Use this when work must freeze the whole renderer (mouse and keyboard), not a dismissible dialog.

- State: `ui.blocks` in [`src/renderer/store/ui.ts`](../src/renderer/store/ui.ts). Dispatch `blockUi({ id, message })` and `unblockUi(id)` from any feature. Same `id` updates the message; nested ids stack.
- Overlay: [`UiBlockOverlay`](../src/renderer/components/UiBlockOverlay.tsx) is mounted in `App` after TopBar (paints on top). It covers pointer input and swallows shortcut events in capture on `window`.
- Not for Settings / AniList / Modal (those stay dismissible). Native Electron dialogs still work because they are a separate window.

Current `blockUi` callers: Settings Library **Scan now** and thumbnail rebuild (`UI_BLOCK_ID_LIBRARY`). Scan on start and interval scans do not lock; they set `ui.libraryScanBusy` so TopBar can show a status control.

## Modal Component

For simple dialogs (confirm, input, etc.), use `Modal` from `@ui/Modal`:

```tsx
<Modal open onClose={close}>
  <h3>Title</h3>
  <input ... />
  <div className="modal-actions">
    <button onClick={close}>Cancel</button>
    <button onClick={submit}>Save</button>
  </div>
</Modal>
```

Modal includes `clickClose`, `modal-overlayCont`, FocusLock, and Escape handling. Custom styles: add `className` (e.g. `text-input-modal`) and define in `_inputs.scss` under `.modal-element.text-input-modal`.

## Text Input Instead of prompt()

Replace `window.prompt("Label")` with:

1. A Modal containing an `<input>` and Save/Cancel buttons (see `TextInputModal`, `AniLogin`)
2. Or inline form UI that appears on action (e.g. expand/collapse)

Example: `src/renderer/components/ui/TextInputModal.tsx`.

## Styles Reference

- Full-screen overlays: `#anilistLogin`, `#anilistEdit`, `#anilistSearch` in `index.scss` / `_readerAnilist.scss`
- Modal base: `src/renderer/styles/mini/_inputs.scss` (`.modal-element`)
- Overlay content: `.overlayCont` or `.modal-overlayCont`; `.overlayCont:not(.settingCont)` has base dimensions (min 500px, 60% width)
