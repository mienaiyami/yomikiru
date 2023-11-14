# Build Guide

Require `git`, `node@v18.15.0` and `yarn`.

```bash

git clone https://github.com/mienaiyami/yomikiru/

cd yomikiru

# install dependencies
yarn install

# run dev build
yarn start

# build for current OS
yarn run make
```

Check [package.json](https://github.com/mienaiyami/yomikiru/blob/a9431648c7d5c6cce82f8572ea2948d37e40f729/package.json#L20), [forge.config.ts -> makers](https://github.com/mienaiyami/yomikiru/blob/a9431648c7d5c6cce82f8572ea2948d37e40f729/forge.config.ts#L42) and <https://www.electronforge.io/config/makers> for more options.

Feel free to ask any questions regarding building using issues. I don't have much experience with different linux distros the code might not work on all out of the box.
