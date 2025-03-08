PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_manga_progress` (
	`itemLink` text PRIMARY KEY NOT NULL,
	`chapterName` text NOT NULL,
	`chapterLink` text NOT NULL,
	`currentPage` integer DEFAULT 1 NOT NULL,
	`chaptersRead` text DEFAULT '[]' NOT NULL,
	`totalPages` integer DEFAULT 0 NOT NULL,
	`lastReadAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_manga_progress`("itemLink", "chapterName", "chapterLink", "currentPage", "chaptersRead", "totalPages", "lastReadAt") SELECT "itemLink", "chapterName", "chapterLink", "currentPage", "chaptersRead", "totalPages", "lastReadAt" FROM `manga_progress`;--> statement-breakpoint
DROP TABLE `manga_progress`;--> statement-breakpoint
ALTER TABLE `__new_manga_progress` RENAME TO `manga_progress`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_bookmarks_item_link` ON `book_bookmarks` (`itemLink`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_book_bookmarks_chapter_id_position` ON `book_bookmarks` (`chapterId`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_book_notes_item_link` ON `book_notes` (`itemLink`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_book_notes_chapter_id_position_selected_text` ON `book_notes` (`chapterId`,`position`,`selectedText`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_manga_bookmarks_item_link` ON `manga_bookmarks` (`itemLink`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_manga_bookmarks_link_page` ON `manga_bookmarks` (`link`,`page`);