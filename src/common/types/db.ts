import type { InferSelectModel } from "drizzle-orm";
import type { z } from "zod";
import type {
    libraryItems,
    mangaProgress,
    bookProgress,
    mangaBookmarks,
    bookBookmarks,
    bookNotes,
} from "../../electron/db/schema";
import {
    AddBookBookmarkSchema,
    AddBookNoteSchema,
    AddMangaBookmarkSchema,
    AddToLibrarySchema,
    UpdateBookProgressSchema,
    UpdateMangaProgressSchema,
} from "../../electron/db/validator";

export type LibraryItem = InferSelectModel<typeof libraryItems>;
export type MangaProgress = InferSelectModel<typeof mangaProgress>;
export type MangaProgressWOChapterRead = Omit<MangaProgress, "chaptersRead">;
export type BookProgress = InferSelectModel<typeof bookProgress>;
export type MangaBookmark = InferSelectModel<typeof mangaBookmarks>;
export type BookBookmark = InferSelectModel<typeof bookBookmarks>;
export type BookNote = InferSelectModel<typeof bookNotes>;

export type Progress = MangaProgress | BookProgress;
export type Bookmark = MangaBookmark | BookBookmark;

export type LibraryItemWithProgress =
    | (LibraryItem & { type: "book"; progress: BookProgress | null })
    | (LibraryItem & { type: "manga"; progress: MangaProgress | null });

// zod schemas are required for these because even unspecified fields get passed
// through the typescript type system
export type AddToLibraryData = z.infer<typeof AddToLibrarySchema>;
export type AddMangaBookmarkData = z.infer<typeof AddMangaBookmarkSchema>;
export type AddBookBookmarkData = z.infer<typeof AddBookBookmarkSchema>;
export type AddBookNoteData = z.infer<typeof AddBookNoteSchema>;
export type UpdateMangaProgressData = z.infer<typeof UpdateMangaProgressSchema>;
export type UpdateBookProgressData = z.infer<typeof UpdateBookProgressSchema>;
