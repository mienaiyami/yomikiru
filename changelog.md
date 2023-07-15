<!-- ## Note

**Due to release changes, existing users (v2.11.5 and below) might need to manually update the app.** -->

<!-- ## Added -->

## Changed

- **Temporarily epub extract and pdf renders temp files wont be deleted (till next version).**
- Slight changes in default themes. Hide delete button on default theme.
- DEV:
  - BrowserWindow `fromWebContents()` instead of `fromId()` in ipcMain to get window.

## Fixed

- #128.
- Issues related to closing window.
  - delete temp files on last window close.
  - history update on last window close.
  - multiple confirms before closing window.

---
