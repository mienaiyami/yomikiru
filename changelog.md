Does not follow semver.

---

## Added

- hide side-list button (only ui) for better performance with high chapter count.
- option to disable auto focus current chapter in side-list for better performance with high chapter count.
- button to focus current chapter in side-list.

## Changed

- reduced chapter transition screen height to 50%.
- electron version updated.
- changed shortcut key list order.
- UI:
  - anilist login ui
- dev:
  - switching from custom to zod to validate settings.
  - code refactor (Reader.tsx), bugs expected.

## Fixed

- quit app on "install and show changelog" after auto download.
- minor keyboard accessability fix, 84a317b5c23e1c3a77b53543a93cad6559d42bfd
- #303, and format fix for .cb7 and .cbr

---
