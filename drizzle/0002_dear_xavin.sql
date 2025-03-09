DROP INDEX `idx_book_bookmarks_item_link`;--> statement-breakpoint
CREATE INDEX `idx_book_bookmarks_item_link` ON `book_bookmarks` (`itemLink`);--> statement-breakpoint
DROP INDEX `idx_book_notes_item_link`;--> statement-breakpoint
CREATE INDEX `idx_book_notes_item_link` ON `book_notes` (`itemLink`);--> statement-breakpoint
DROP INDEX `idx_manga_bookmarks_item_link`;--> statement-breakpoint
CREATE INDEX `idx_manga_bookmarks_item_link` ON `manga_bookmarks` (`itemLink`);