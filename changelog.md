
## Downloads

[![Download setup](https://img.shields.io/badge/Windows%20Setup%20(exe)-$$EXE_NAME$$-brightgreen?logo=windows&logoColor=blue)](https://github.com/mienaiyami/react-ts-offline-manga-reader/releases/download/v$$TAG$$/$$EXE_NAME$$)

[![Download Portable](https://img.shields.io/badge/Windows%20Portable%20(zip)-$$ZIP_NAME$$-brightgreen?logo=windows&logoColor=blue)](https://github.com/mienaiyami/react-ts-offline-manga-reader/releases/download/v$$TAG$$/$$ZIP_NAME$$)

---

## Added

- Open app automatically after updating (portable version).
- New shortcuts to switch between `PagePerRow` and `ReaderType`.
- Set max width of images (works only when `Size Clamp` is disabled).
- Search bar:
  - Paste link in search bar to open.
  - Type `..\` to go up directory.
  - Type name of item in results ending with `\` to open it in reader. e.g. `One Piece\`.
  - Type drive name ending with `:\` to change drive. e.g. `D:\`.
- Save toggled state of bookmark / history tab.


## Changed

- Better searching system.
- Prevent some shortcuts if key pressed is held/repeated.
- Disable chapter transition screen in zen mode as well.
- Images in reader are now un-draggable.
- Scroll to current page number after changing `PagePerRow` and `ReaderType`.
- Removed checking for `.bin` file.
- Prevent some shortcuts from working if pressed in combination with `ctrl` key.
- UI enhancements.

## Fixed

- App appear frozen when opening `.zip` or `.cbz` file.

---

#### Todo

- Add canvas based image system for performance.
- Write testing.
- Adjust app for debian.

---

