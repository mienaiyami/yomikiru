# Electron upgrade blocker: Sharp AVIF library covers

> Last updated: 2026-08-25. **Read this when bumping Electron or Sharp.**  
> Status: **known limitation, not yet fixed** — blocked on Electron upgrade policy (Windows 7 / legacy OS support).

---

## Purpose

Some library items use **10-bit (high-bitdepth) AVIF** page images as their cover source. The main-process Sharp pipeline cannot decode them on the current stack. Chromium in the reader **can** display those files, but cover materialization fails and gallery tiles stay empty unless another cover path exists.

This document records the issue, investigation, constraints, and the **intended fix** to apply alongside a future Electron upgrade. It is meant for humans and agents reviewing dependency bumps — search keywords: `electron upgrade`, `sharp`, `avif`, `cover`, `materialize`, `10-bit`, `heif`.

---

## Symptoms

Main-process logs during library scan, thumbnail regenerate, or `covers:materialize`:

```text
(main/util/coverMaterialize) materializeCover failed libraryId=<id> src="<path>.avif"
<path>.avif: bad seek to <offset>
<path>.avif: bad seek to <offset>
heif: Invalid input: Unspecified: Bitstream not supported by this decoder (2.0)
(main/ipc/covers) covers:materializeFromLibraryPath id=<id> failed: ...
```

Typical pattern:

- Source is a `.avif` file (often the first page of a chapter folder).
- Reader opens and renders the image normally.
- `userData/covers/<libraryId>.webp` is never written.
- Gallery tile shows the empty/broken cover state unless `library_items.cover` points at another file.

---

## Root cause

| Layer | Detail |
| --- | --- |
| Pipeline | [`src/electron/util/coverMaterialize.ts`](../src/electron/util/coverMaterialize.ts) — Sharp `rotate` → `resize(400)` → WebP → `userData/covers/<id>.webp` |
| Allowed ext | `.avif` is in [`IMAGE_EXTS`](../src/common/library/formats.ts) |
| Sharp version | `^0.34.5` ([`package.json`](../package.json)) |
| Prebuilt limit | Sharp **0.34.x** prebuilt `@img/sharp-libvips-*` binaries decode **8-bit AVIF only** |
| Failing inputs | Many real-world manga AVIF exports are **10-bit** (sometimes 12-bit); libaom/libheif rejects them with `bad seek` / bitstream-not-supported |

Upstream references:

- [lovell/sharp#2688](https://github.com/lovell/sharp/issues/2688) — 10-bit AVIF input and `bad seek` errors
- [Sharp v0.28.0 changelog](https://sharp.pixelplumbing.com/changelog/v0.28.0) — prebuilt AVIF limited to 8-bit depth
- [lovell/sharp-libvips#367](https://github.com/lovell/sharp-libvips/pull/367) — aom HDR / 10–12-bit enable (landed in libvips prebuilts used by Sharp **0.35+**)
- Maintainer note on [sharp-libvips#247](https://github.com/lovell/sharp-libvips/issues/247) — Sharp **v0.35.0** allows 10-bit and 12-bit AVIF decode (first step toward full HDR/CICP)

There is **no runtime flag** on Sharp 0.34.x to enable high-bitdepth AVIF decode in prebuilts.

---

## Why this is not fixed yet

### Electron pinned for legacy OS support

| Pin | Value | Reason |
| --- | --- | --- |
| Electron | **22.3.25** | Last line that supports **Windows 7** and other old OS targets the project still ships for |
| Bundled Node (Electron 22) | **16.x** | ABI / runtime shipped with Electron 22 |
| Sharp 0.35+ `engines.node` | **>= 20.9.0** | Declared in [Sharp v0.35.0 changelog](https://sharp.pixelplumbing.com/changelog/v0.35.0) |

**Policy:** Electron cannot be upgraded until legacy-OS support is dropped. Sharp **0.35+** (the upstream fix for 10-bit AVIF decode in prebuilts) should be bumped **together with** the Electron upgrade, not on the current Electron 22 stack.

### Packaging today

Sharp is loaded from an explicit Forge external runtime (`resources/sharp/`), not ASAR — see [`forge.config.ts`](../forge.config.ts) and [`docs/archive-backend.md`](archive-backend.md). An upgrade must re-verify that copy path and packaged cover materialize on win32, linux, and macOS targets.

---

## Current user impact

- Library **scan** and **thumbnail regenerate** add the row but leave no WebP cache when the cover source is an unsupported AVIF.
- **Custom cover pick** or a sidecar `cover.jpg` / `cover.png` still works.
- **Reader** is unaffected — Chromium decodes AVIF independently of Sharp.
- **PDF covers** use a separate renderer canvas path ([`ensurePdfLibraryCover`](../src/renderer/utils/libraryCoverService.ts)); unrelated to this AVIF issue.

Cover URL resolution ([`libraryCoverSrc`](../src/renderer/utils/libraryCover.ts)):

1. `library_items.cover` file if set and exists  
2. else `userData/covers/<id>.webp` if exists  
3. else empty tile  

No dual-path fallback to the source AVIF is implemented yet.

---

## Investigation summary (2026-08-25)

Options evaluated for fixing cover materialize without upgrading Electron + Sharp:

| Approach | Verdict |
| --- | --- |
| **Upgrade Sharp to >= 0.35** with Electron bump | **Preferred fix** — same Forge packaging model; main-owned scan keeps working |
| Hidden Chromium `BrowserWindow` for decode | **Rejected** — extra process cost; wrong ownership for app-wide scan |
| Existing-window canvas decode (PDF acquire/release pattern) | Possible **deferred** fill-in when a gallery window is open; does **not** help scan with zero windows |
| Dual-path / skip (serve source AVIF in gallery when WebP missing) | Reasonable **interim** safety net; not shipped |
| Wasm decoder on main (`@jsquash/avif`, `libheif-js`) | Extra dep + size; only if Sharp upgrade blocked long-term |
| Second native stack (`@napi-rs/image`, etc.) | Duplicate packaging; avoid |
| External CLI (`avifdec`, ImageMagick) | Heavy per-platform ship; avoid |
| Build Sharp/libvips from source with high bitdepth on 0.34.x | Poor fit for Windows Electron releases |

**Decision:** Document and defer until Electron upgrade. No code change on the current stack.

---

## Fix checklist (when Electron is upgraded)

Apply in the **same change** (or tightly coupled PR) as the Electron bump:

### 1. Dependencies

- [ ] Bump `sharp` to **>= 0.35.x** (verify latest patch on npm)
- [ ] Bump Electron to a version whose bundled Node satisfies Sharp's `engines` (>= 20.9.0 for 0.35.0)
- [ ] Re-run install; confirm `@img/sharp-<platform>` and `@img/sharp-libvips-<platform>` versions updated under `node_modules`

### 2. Sharp 0.35 breaking changes (regression surface)

Review [Sharp v0.35.0 changelog](https://sharp.pixelplumbing.com/changelog/v0.35.0) and test:

- [ ] Cover materialize still writes WebP (`coverMaterialize.ts` pipeline)
- [ ] Archive / EPUB stream covers (`materializeCoverFromStream`)
- [ ] Library scan bulk materialize ([`libraryScan.ts`](../src/electron/util/libraryScan.ts))
- [ ] Settings thumbnail regenerate
- [ ] Packaged app (not dev-only): Sharp loads from `resources/sharp/` ([`coverMaterialize.ts`](../src/electron/util/coverMaterialize.ts) `loadSharp`)

### 3. AVIF-specific verification

Use at least one **10-bit AVIF** fixture (not only 8-bit):

- [ ] `covers:materialize` succeeds; `userData/covers/<id>.webp` is non-empty
- [ ] No `bad seek` / `Bitstream not supported by this decoder` in logs
- [ ] Gallery tile shows thumbnail after scan and after regenerate

Optional: confirm 8-bit AVIF and existing JPG/PNG/WebP covers still materialize.

### 4. Packaging

- [ ] `pnpm make:zip64` (and deb/mac targets if applicable)
- [ ] Packaged artifact: materialize a 10-bit AVIF cover on **Windows** and **Linux** CI targets
- [ ] Forge still copies Sharp runtime to `resources/sharp/node_modules` ([`forge.config.ts`](../forge.config.ts))

### 5. Tests and lint

- [ ] Extend [`coverMaterialize.test.ts`](../src/electron/util/coverMaterialize.test.ts) if new helpers or error classification are added
- [ ] `pnpm test` / `pnpm test:db` as appropriate
- [ ] `pnpm tslint`

### 6. Docs and release notes

- [ ] Update this file: set status to **fixed**, note Electron + Sharp versions, remove or shorten blocker sections
- [ ] Changelog entry under the release that ships the bump
- [ ] Optional: one line under [Cover System in library.md](library.md) if the pointer is still useful

---

## Code map

| Concern | Location |
| --- | --- |
| WebP materialize | [`src/electron/util/coverMaterialize.ts`](../src/electron/util/coverMaterialize.ts) |
| IPC handlers | [`src/electron/ipc/covers.ts`](../src/electron/ipc/covers.ts) |
| Scan-time materialize | [`src/electron/util/libraryScan.ts`](../src/electron/util/libraryScan.ts) |
| Renderer orchestration | [`src/renderer/utils/libraryCoverService.ts`](../src/renderer/utils/libraryCoverService.ts) |
| Cover URL resolution | [`src/renderer/utils/libraryCover.ts`](../src/renderer/utils/libraryCover.ts) |
| Sharp Forge packaging | [`forge.config.ts`](../forge.config.ts) |
| Image extensions | [`src/common/library/formats.ts`](../src/common/library/formats.ts) |

---

## Optional follow-ups (not required for Sharp upgrade)

If empty tiles remain rare after Sharp 0.35 (corrupt files, exotic codecs):

- Dual-path: when materialize fails for `.avif`, fall back to source path in gallery (mind archive temp paths)
- Deferred encode via existing renderer window (mirror PDF `acquirePdfRender` / `releasePdfRender`)

Do **not** reintroduce a dedicated hidden BrowserWindow for decode.

---

## Related docs

- [library.md — Cover System](library.md#cover-system)
- [archive-backend.md — Sharp packaging](archive-backend.md)
