# Make app for linux (debian)

Direct download for Linux is unavailable because it is not possible to build for both Windows and Linux from the same OS. It might be possible, but I don't have enough knowledge to make it happen. If you are a developer and know a way, then please consider contributing.

---

Requires latest version of nodejs.
Also requires `fakeroot` and `dpkg` packages installed on machine to build and `unzip` and `xdg-utils` to use all app features.

1. Clone this repo on your machine.
2. Run `npm install` or `yarn install` in terminal at base directory.
3. Run `npm run make:deb` or `yarn make:deb`.
4. `.deb` will be avaliable in `./out/make/deb/x64/`, to install this simply run `sudo dpkg -i <OUTPUT_FILE_NAME.deb>`.
