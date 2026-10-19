# Archive backend

Yomikiru uses one full 7-Zip executable for archive work in the Electron main process. It supports packed manga in ZIP/CBZ, RAR/CBR, and 7z/CB7 containers, and EPUB because EPUB is a ZIP package.

`src/electron/util/archive.ts` is the module interface. Callers can list entries, stream one exact entry, extract a complete archive for a reader cache, or create a ZIP export. It owns executable selection, safe entry-name handling, cancellation, and diagnostics; callers must not launch 7-Zip directly.

## Content flows

- Scan and manual cover refresh list archive entries and stream only the selected manga cover. EPUB scan reads `META-INF/container.xml`, the OPF package document, and the declared cover entry. These paths do not write archive pages to a temporary directory.
- The packed manga and EPUB readers use full extraction because the renderer needs the complete page or package tree. Packed manga extraction still flattens entry paths after extraction for the established reader file-list contract.
- Translation-pack import/export and portable-update extraction use the same module. Translation packs retain their existing post-extraction path and symlink validation.

## Packaging and verification

Electron Forge copies only the runtime for the package target to `resources/7zip/<architecture>` outside ASAR. Universal macOS packages receive both runtime architectures; other packages receive only their selected architecture. The module resolves this resource executable in packaged builds and the dependency executable in development. Windows receives the matching `7z.exe` and `7z.dll`, while macOS and Linux receive the standalone `7zz` executable.

Webpack owns relocatable native Node dependencies such as `better-sqlite3`. Its asset relocator writes them beside the main-process bundle and initializes their runtime base path in both clean and incremental builds.

Sharp is an explicit exception because it chooses an `@img/sharp-*` package using the runtime platform and architecture, which cannot be statically relocated. Forge copies Sharp, its ordinary runtime dependencies, and only the matching native package to `resources/sharp/node_modules`; the cover module loads it from that explicit resource root. Keeping the complete Sharp runtime outside ASAR also keeps its native binary and companion libraries together as ordinary files.

Run these checks before release:

```sh
pnpm test:db -- src/electron/util/archive.test.ts src/electron/util/contentSource.test.ts
pnpm tslint
pnpm make:zip64
```

Exercise CBZ, CBR/RAR5, CB7 including a solid archive, and EPUB2/EPUB3 in the packaged artifact. A corrupt, encrypted, or image-less archive must fail only that cover or open operation, never the overall library scan.
