CREATE TABLE `item_trackers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itemLink` text NOT NULL,
	`provider` text NOT NULL,
	`remoteId` text NOT NULL,
	`remoteListId` text,
	`remoteUrl` text,
	`media` text,
	`listState` text,
	`syncedAt` integer,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_item_trackers_provider_remote` ON `item_trackers` (`provider`,`remoteId`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_item_trackers_item_provider` ON `item_trackers` (`itemLink`,`provider`);--> statement-breakpoint
CREATE TABLE `library_item_metadata` (
	`itemLink` text NOT NULL,
	`source` text NOT NULL,
	`title` text,
	`author` text,
	`description` text,
	`genres` text,
	`tags` text,
	`publisher` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`itemLink`, `source`),
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `library_item_tags` (
	`itemLink` text NOT NULL,
	`tagId` integer NOT NULL,
	PRIMARY KEY(`itemLink`, `tagId`),
	FOREIGN KEY (`itemLink`) REFERENCES `library_items`(`link`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `library_tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_library_item_tags_tag_id` ON `library_item_tags` (`tagId`);--> statement-breakpoint
CREATE TABLE `library_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_library_tags_name` ON `library_tags` (lower(trim("name")));--> statement-breakpoint
ALTER TABLE `library_items` ADD `favouritedAt` integer;--> statement-breakpoint
ALTER TABLE `library_items` ADD `note` text;--> statement-breakpoint
ALTER TABLE `library_items` ADD `extra` text DEFAULT '{}' NOT NULL;