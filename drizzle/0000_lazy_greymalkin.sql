CREATE TABLE `book_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itemLink` text NOT NULL,
	`chapterId` text NOT NULL,
	`position` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itemLink` text NOT NULL,
	`chapterId` text NOT NULL,
	`position` text NOT NULL,
	`content` text NOT NULL,
	`selectedText` text NOT NULL,
	`color` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`author` text,
	`cover` text
);
--> statement-breakpoint
CREATE TABLE `manga_bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itemLink` text NOT NULL,
	`page` integer NOT NULL,
	`link` text NOT NULL,
	`note` text DEFAULT '',
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `manga_progress` (
	`itemLink` text PRIMARY KEY NOT NULL,
	`chapterName` text NOT NULL,
	`chapterLink` text NOT NULL,
	`currentPage` integer DEFAULT 1 NOT NULL,
	`chaptersRead` text NOT NULL,
	`totalPages` integer,
	`lastReadAt` integer NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
