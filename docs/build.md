# Build Guide

Require `git`, `node@v18.15.0` and `pnpm`.

```bash

git clone https://github.com/mienaiyami/yomikiru/

cd yomikiru

# install dependencies
pnpm install

# run dev build
pnpm start

# build for current OS
pnpm run make
```

Check [package.json](https://github.com/mienaiyami/yomikiru/blob/a9431648c7d5c6cce82f8572ea2948d37e40f729/package.json#L20), [forge.config.ts -> makers](https://github.com/mienaiyami/yomikiru/blob/a9431648c7d5c6cce82f8572ea2948d37e40f729/forge.config.ts#L42) and <https://www.electronforge.io/config/makers> for more options.

Feel free to ask any questions regarding building using issues. I don't have much experience with different linux distros the code might not work on all out of the box.

> [!NOTE]
> Native modules need to compiled for electron's node version. If you have issues with native modules, try running `pnpm rebuild:node` or `pnpm rebuild:electron` to rebuild native modules for electron.
> Try removing `node_modules` and running `pnpm install` again if you still have issues.
> Contact me if you have issues.
