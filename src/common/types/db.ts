import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
    libraryItems,
    mangaProgress,
    bookProgress,
    mangaBookmarks,
    bookBookmarks,
    bookNotes,
} from "../../electron/db/schema";

export type LibraryItem = InferSelectModel<typeof libraryItems>;
export type MangaProgress = InferSelectModel<typeof mangaProgress>;
export type BookProgress = InferSelectModel<typeof bookProgress>;
export type MangaBookmark = InferSelectModel<typeof mangaBookmarks>;
export type BookBookmark = InferSelectModel<typeof bookBookmarks>;
export type BookNote = InferSelectModel<typeof bookNotes>;

export type Progress = MangaProgress | BookProgress;
export type Bookmark = MangaBookmark | BookBookmark;
