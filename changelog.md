> [!Important]
> Some additional context : <https://github.com/mienaiyami/yomikiru/discussions/384#discussioncomment-9852596>

---

> [!Note]
> To keep getting beta updates, check the beta update channel in settings after downloading the beta version.

## 2.21.0-beta.1

### Major Changes

1. **Database Migration**: Complete transition from JSON files to SQLite database using Drizzle ORM for improved performance and data integrity
2. **Redux Store Restructuring**: Consolidated multiple small slices into more comprehensive reducers for better state management
3. **Enhanced EPUB Reader**: Completely(ish) rebuilt EPUB reader with better navigation, rendering, and performance
4. **Improved Bookmarks & Notes**: Multiple bookmarks per manga-chapter, notes in epub, color options, context menu integration, and better organization
5. **Type Safety**: Comprehensive improvements to TypeScript usage throughout the application

### Breaking Changes

1. **Package Manager**: Migrated from Yarn to PNPM
2. **Library Data Format**: Changed library data storage format (automatic migration included)/ Any bookmarks.json, history.json will be migrated to new format, if present in userData folder.
3. **EPUB Reader**: txt and single html files now not supported (temporary?).

### Future Plans

- Implement gallery view for home page.
- Change in UI components to use custom Radix UI for better accessibility and maintainability.
- Replace IPC redux slices with Tanstack Query based hooks??.
- Move from webpack to Vite??.
- Redo of CSS.
- **Windows 7 deprecation.** Current version of electron is causing many issues and I have planned to migrate to a newer version of electron which is not supported by Windows 7. It will be done after gallery view is implemented.

---

These are just a simple AI generated summary of changes. For more detailed changelog, please refer to the [commit history](https://github.com/mienaiyami/yomikiru/commits/wip/migrate-to-sqlite).

### March 2024

- **feat**: Better EPUB reader implementation
  - Added improved chapter navigation and rendering
  - Fixed SVG image rendering
  - Enhanced "find in page" functionality
  - Added better footnote popup support
  - Fixed chapter name getters and TOC navigation

### February 2025

- **BREAKING CHANGE**: Migrated from Yarn to PNPM package manager
- **feat!**: Major database refactoring
  - Migrated from JSON-based storage to SQLite with Drizzle ORM
  - Improved data persistence and management
  - Added database migration utilities for legacy data
  - Added proper schema validation with Zod

- **feat**: Improved project structure
  - Reorganized webpack configuration
  - Updated TypeScript configuration with path aliases
  - Better code organization and modular architecture

- **fix**: Support dash as delimiter in chapter names (#402)
- **fix**: Prevent crash when filtering with regexp characters (#400)

### March 2025

- **refactor**: Consolidated Redux store structure
  - Merged multiple single-purpose slices into comprehensive reducers
  - Created new `ui` and `anilist` slices for centralized state management
  - Improved type safety and state organization

- **refactor**: Enhanced reader state management
  - Created new `reader` Redux slice
  - Improved progress tracking for both book and manga readers
  - Simplified state management across components

- **feat**: Implemented robust and reusable list navigator
- **feat**: Added handling for non-existent library/bookmark items
- **feat**: Improved loading states and indicators

### April 2025

- **BREAKING CHANGE**: Removed open in reader arrow from UI
- **feat**: Enhanced bookmarks and notes
  - Added note creation from context menu
  - Added color options in note editor
  - Improved bookmark sorting functionality
  - Enhanced date utilities for bookmarks

- **feat**: Improved app update handling
  - Added update channel selection (stable/beta)
  - Enhanced update download process with cancellation handling
  - Prevented errors when closing download window

- **feat**: Enhanced main settings management
  - Added isPortable property to process object
  - Integrated main process settings management
  - Migrated old settings to new format

- **fix**: Adjusted scroll position calculation
- **fix**: Improved error handling for directory access
- **fix**: Prevented flatten directory in EPUB (#409)

---

Note: This beta version represents a significant architectural overhaul and may contain additional bugs. Please report any issues on GitHub with the beta tag.
