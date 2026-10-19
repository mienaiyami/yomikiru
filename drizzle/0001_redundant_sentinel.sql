-- Production-safe upgrade: library_items.id, manga_progress without chapterLink, manga_bookmarks without link.
-- Run after normalizeLegacyMangaDataBeforeMigration() (see DatabaseService.initialize).
-- Note: `PRAGMA foreign_keys` does not apply inside Drizzle's migrator transaction; DatabaseService.initialize
-- runs `pragma("foreign_keys = OFF")` on the connection before `migrate()` so `DROP TABLE library_items` does not CASCADE.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_library_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`link` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`author` text,
	`cover` text
);--> statement-breakpoint
INSERT INTO `__new_library_items` (`link`, `type`, `title`, `updatedAt`, `createdAt`, `author`, `cover`)
SELECT `link`, `type`, `title`, `updatedAt`, `createdAt`, `author`, `cover` FROM `library_items`;--> statement-breakpoint
DROP TABLE `library_items`;--> statement-breakpoint
ALTER TABLE `__new_library_items` RENAME TO `library_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `library_items_link_unique` ON `library_items` (`link`);--> statement-breakpoint
ALTER TABLE `manga_progress` DROP COLUMN `chapterLink`;--> statement-breakpoint
DROP INDEX IF EXISTS `uq_manga_bookmarks_link_page`;--> statement-breakpoint
ALTER TABLE `manga_bookmarks` DROP COLUMN `link`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_manga_bookmarks_item_chapter_page` ON `manga_bookmarks` (`itemLink`,`chapterName`,`page`);--> statement-breakpoint
PRAGMA foreign_keys=ON;