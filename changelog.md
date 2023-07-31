## Added

- Option to render multiple pdfs, #216. Access from settings.
- Context menu keyboard navigation.
- Option to mark chapter as unread in home-location-list and reader-side-list, #213.
- EPUB double click fullscreen.
- Search bar and list navigation with keyboard. Check Settings -> Extras -> "Search tab shortcuts" for more.
- Context menu in epub reader.

## Changed

- UI Changes:
  - Moved "usage & features" to "extras" tab.
  - Context menu related changes.
  - Highlight element on setting link click navigation.
  - #220.
  - Added custom number input spinner.
  - and more.
  - Text update in some loading screens.
- EPUB:
  - Use default padding and margins for all elements.
  - Confirm before opening external links.
  - Don't render side list in zen mode, improve performance but lag when exiting zen mode if very high chapter count.
- DEV:
  - Context Menu system changed, made modular and context based rather than redux.
  - pdf render optimization.

## Fixed

- Epub without toc does not open.
- Epub side-list performance issue, [more in #202](https://github.com/mienaiyami/yomikiru/issues/202#issuecomment-1655858560).
- Epub "open in new window" error.

---