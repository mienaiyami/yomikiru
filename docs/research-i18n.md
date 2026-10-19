# Research: Electron + React i18n (i18next) and user language packs

> Date: 2026-08-09. Primary sources: i18next / react-i18next / Electron docs. Implementation decisions for Yomikiru are summarized at the end.

## Verdict

Use **i18next** + **react-i18next** in the renderer and a **separate i18next instance** in Electron main. Ship namespaced English JSON. User packs are **one locale per pack**, stored under `userData`, deep-merged with `addResourceBundle(..., true, true)`. Do **not** use `i18next-chained-backend` for overlays (first successful namespace wins, hiding bundled keys). Prefer webpack-imported bundled JSON over `i18next-fs-backend` for catalogs; packs use Node `fs` + existing `cross-zip`.

## Primary-source notes

### Namespaces and lazy load

- Namespaces split large catalogs and support per-feature loading: [Namespaces](https://www.i18next.com/principles/namespaces), [Multiple translation files](https://react.i18next.com/guides/multiple-translation-files).
- Dynamic `import()` via resources-to-backend: [Add or load translations](https://www.i18next.com/how-to/add-or-load-translations).

### Overlay merge

- `addResourceBundle(lng, ns, resources, deep, overwrite)` deep-merges nested keys: [API](https://www.i18next.com/overview/api#addresourcebundle).
- Chained backend is first-wins per `(lng, ns)`, not key-level merge: [i18next-chained-backend](https://github.com/i18next/i18next-chained-backend).

### Electron locale APIs

- Electron provides locale **detection** (`app.getPreferredSystemLanguages`, etc.), not app string catalogs: [app](https://www.electronjs.org/docs/latest/api/app).
- Dialogs / menus / tray take plain strings you supply: [dialog](https://www.electronjs.org/docs/latest/api/dialog), [Tray](https://www.electronjs.org/docs/latest/api/tray).

### ASAR / userData

- Packaged asar is effectively read-only for writes; user packs must live under `userData`: [ASAR](https://www.electronjs.org/docs/latest/tutorial/asar-archives), [app.getPath](https://www.electronjs.org/docs/latest/api/app#appgetpathname).
- fs-backend warns that `.js`/`.ts` locale files are executed: [i18next-fs-backend security](https://github.com/i18next/i18next-fs-backend/blob/master/README.md#security-considerations). Yomikiru accepts **JSON only**.

### React Suspense

- `useTranslation` can suspend when `useSuspense` is true: [useTranslation](https://react.i18next.com/latest/usetranslation-hook). Yomikiru uses React 17 → `useSuspense: false`.

## Yomikiru decisions (locked)

1. `languageSourceId` only (`builtin:en` / `pack:<id>`); dropdown shows `locale - name`.
2. One locale per pack; flat folder; hard-reject unknown files.
3. `i18n:setSource` is the sole mutation path for language.
4. `i18n:changed` sends `{ locale, sourceId, packOverlay }` (full payload).
5. Reuse `cross-zip`; no `i18next-fs-backend` dependency.
6. Usage docs migrate last with a non-JSON-sentence approach.
