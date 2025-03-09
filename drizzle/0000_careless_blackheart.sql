CREATE TABLE `book_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itemLink` text NOT NULL,
	`chapterName` text DEFAULT '~' NOT NULL,
	`chapterId` text NOT NULL,
	`position` text NOT NULL,
	`note` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_book_bookmarks_item_link` ON `book_bookmarks` (`itemLink`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_book_bookmarks_chapter_id_position` ON `book_bookmarks` (`chapterId`,`position`);--> statement-breakpoint
CREATE TABLE `book_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itemLink` text NOT NULL,
	`chapterId` text NOT NULL,
	`position` text NOT NULL,
	`content` text NOT NULL,
	`selectedText` text NOT NULL,
	`color` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_book_notes_item_link` ON `book_notes` (`itemLink`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_book_notes_chapter_id_position_selected_text` ON `book_notes` (`chapterId`,`position`,`selectedText`);--> statement-breakpoint
CREATE TABLE `book_progress` (
	`itemLink` text PRIMARY KEY NOT NULL,
	`chapterId` text NOT NULL,
	`chapterName` text DEFAULT '~' NOT NULL,
	`position` text NOT NULL,
	`lastReadAt` integer NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `library_items` (
	`link` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`updatedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`author` text,
	`cover` text
);
--> statement-breakpoint
CREATE TABLE `manga_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itemLink` text NOT NULL,
	`chapterName` text DEFAULT '~' NOT NULL,
	`page` integer NOT NULL,
	`link` text NOT NULL,
	`note` text DEFAULT '',
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_manga_bookmarks_item_link` ON `manga_bookmarks` (`itemLink`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_manga_bookmarks_link_page` ON `manga_bookmarks` (`link`,`page`);--> statement-breakpoint
CREATE TABLE `manga_progress` (
	`itemLink` text PRIMARY KEY NOT NULL,
	`chapterName` text NOT NULL,
	`chapterLink` text NOT NULL,
	`currentPage` integer DEFAULT 1 NOT NULL,
	`chaptersRead` text DEFAULT '[]' NOT NULL,
	`totalPages` integer DEFAULT 0 NOT NULL,
	`lastReadAt` integer NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
