~~`yarn add pdfjs-dist --ignore-optional` to prevent `canvas` install.~~
~~`canvas` cause native dependency rebuild and cause error.~~
~~`pdfjs-dist` ts type error can be fixed by coping `types.d.ts` from `legacy/build` to `build`.~~
using pdfjs-dist fork without canvas.

