import type { InferSelectModel } from "drizzle-orm";
import type { z } from "zod";
import type {
    bookBookmarks,
    bookNotes,
    bookProgress,
    itemTrackers,
    libraryItemMetadata,
    libraryItems,
    libraryItemTags,
    libraryTags,
    mangaBookmarks,
    mangaProgress,
} from "../../electron/db/schema";
import type {
    AddBookBookmarkSchema,
    AddBookNoteSchema,
    AddMangaBookmarkSchema,
    AddToLibrarySchema,
    CreateLibraryTagSchema,
    DeleteLibraryTagSchema,
    RemoveItemTrackerSchema,
    SetLibraryItemMetadataSchema,
    SetLibraryItemTagsSchema,
    UpdateBookBookmarkSchema,
    UpdateBookProgressSchema,
    UpdateLibraryItemSchema,
    UpdateLibraryTagSchema,
    UpdateMangaBookmarkSchema,
    UpdateMangaProgressSchema,
    UpdateTrackerSnapshotSchema,
    UpsertItemTrackerSchema,
} from "../../electron/db/validator";

export type {
    LibraryItemExtra,
    LibraryItemMetadataSource,
    TrackerListState,
    TrackerMediaSnapshot,
    TrackerProvider,
} from "../../electron/db/schema";

export type LibraryItem = InferSelectModel<typeof libraryItems>;
export type MangaProgress = InferSelectModel<typeof mangaProgress>;
export type MangaProgressWOChapterRead = Omit<MangaProgress, "chaptersRead">;
export type BookProgress = InferSelectModel<typeof bookProgress>;
export type MangaBookmark = InferSelectModel<typeof mangaBookmarks>;
export type BookBookmark = InferSelectModel<typeof bookBookmarks>;
export type BookNote = InferSelectModel<typeof bookNotes>;
export type ItemTracker = InferSelectModel<typeof itemTrackers>;
export type LibraryItemMetadata = InferSelectModel<typeof libraryItemMetadata>;
/** Catalog row the user creates, then assigns to library items. */
export type LibraryTag = InferSelectModel<typeof libraryTags>;
/** Join row: which catalog tag is on which library item. */
export type LibraryItemTag = InferSelectModel<typeof libraryItemTags>;

export type Progress = MangaProgress | BookProgress;
export type Bookmark = MangaBookmark | BookBookmark;

export type LibraryItemWithProgress =
    | (LibraryItem & { type: "book"; progress: BookProgress | null })
    | (LibraryItem & { type: "manga"; progress: MangaProgress | null });

// zod schemas are required for these because even unspecified fields get passed
// through the typescript type system
export type AddToLibraryData = z.infer<typeof AddToLibrarySchema>;
export type UpdateLibraryItemData = z.infer<typeof UpdateLibraryItemSchema>;
export type AddMangaBookmarkData = z.infer<typeof AddMangaBookmarkSchema>;
export type AddBookBookmarkData = z.infer<typeof AddBookBookmarkSchema>;
export type AddBookNoteData = z.infer<typeof AddBookNoteSchema>;
export type UpdateMangaBookmarkData = z.infer<typeof UpdateMangaBookmarkSchema>;
export type UpdateBookBookmarkData = z.infer<typeof UpdateBookBookmarkSchema>;
export type UpdateMangaProgressData = z.infer<typeof UpdateMangaProgressSchema>;
export type UpdateBookProgressData = z.infer<typeof UpdateBookProgressSchema>;
export type UpsertItemTrackerData = z.infer<typeof UpsertItemTrackerSchema>;
export type RemoveItemTrackerData = z.infer<typeof RemoveItemTrackerSchema>;
export type UpdateTrackerSnapshotData = z.infer<typeof UpdateTrackerSnapshotSchema>;
export type SetLibraryItemMetadataData = z.infer<typeof SetLibraryItemMetadataSchema>;
export type CreateLibraryTagData = z.infer<typeof CreateLibraryTagSchema>;
export type UpdateLibraryTagData = z.infer<typeof UpdateLibraryTagSchema>;
export type DeleteLibraryTagData = z.infer<typeof DeleteLibraryTagSchema>;
export type SetLibraryItemTagsData = z.infer<typeof SetLibraryItemTagsSchema>;
