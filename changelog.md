Does not follow semver.

---

## Added

- #242, sort by date option in reader-side-list.
- epub letter spacing option.
- added "dbl-click zen-mode" to epub body right click.
- added #241, reader size shortcut keys.
- added scroll reader with mouse grab.
- #202, open single .txt or xhtml file. `experimental`

## Changed

- #234, linked select hover/focused color to context-menu
- #244, open epub from bookmark/history using chapterName -> chapterURL.
- epub line (&lt;HR/&gt;) color to font-color from divider-color.
- tab click focusable switches.
- disable dbl-click zen-mode when "epub: text select" is enabled.
- hide quotes in epub font select options.
- change top-bar color when window is not focused.
- Select Option:
  - focus on selected option on open.
  - click matching alphabet to scroll option into view.

## Fixed

- fixed epub chapter reset after clicking a reference link.
- epub font select working even when disabled.
- fixed, image size over 100% not working right.
- "NaN%" progress in epub zen mode if body have no scroll.

---