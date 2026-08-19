import { relations, sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, unique, uniqueIndex } from "drizzle-orm/sqlite-core";

const timeNow = sql`(unixepoch() * 1000)`;

/**
 * Durable loosely-defined fields on a library item that have not earned a dedicated column.
 * Named keys are added to this type as they appear; unknown keys require a type narrowing to read.
 * When a key graduates, a migration moves the data into a real column.
 */
export type LibraryItemExtra = {
    [key: string]: unknown;
};

/** Tracker slug stored on {@link itemTrackers.provider}. SQLite has no CHECK; this is TypeScript-only. */
export type TrackerProvider = "anilist";

/** Who wrote a {@link libraryItemMetadata} row. `"file"` is reserved for later embedded-metadata extraction. */
export type LibraryItemMetadataSource = "user" | "file";

/**
 * Provider-agnostic cached snapshot of a tracked title. Rebuildable; never authoritative.
 * Search hits may fill fewer fields than a full list-entry fetch.
 */
export type TrackerMediaSnapshot = {
    title?: string | null;
    coverImage?: string | null;
    bannerImage?: string | null;
    description?: string | null;
    genres?: string[];
    status?: string | null;
    format?: string | null;
    totalChapters?: number | null;
    siteUrl?: string | null;
    score?: number | null;
};

/**
 * Cached list-entry state from a tracker (progress, reading status, score). Rebuildable.
 */
export type TrackerListState = {
    status?: string | null;
    progress?: number | null;
    progressVolumes?: number | null;
    score?: number | null;
};

export const libraryItems = sqliteTable("library_items", {
    id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
    /** link of manga/book file or folder, not a chapter */
    link: text().notNull().unique(),
    type: text({ enum: ["manga", "book"] }).notNull(),
    title: text().notNull(),
    updatedAt: integer({ mode: "timestamp_ms" })
        .notNull()
        .default(timeNow)
        .$onUpdate(() => new Date()),
    createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
    author: text(),
    cover: text(),
    /** When set, the item appears in the gallery Favourites tab. Null means not favourited. */
    favouritedAt: integer({ mode: "timestamp_ms" }),
    /** User commentary on the library item, not chapter/bookmark notes. */
    note: text(),
    /**
     * Durable JSON grab-bag for fields that have not earned a column.
     * SQL `'{}'` default so drizzle-kit can ADD COLUMN without rebuilding `library_items`.
     */
    extra: text({ mode: "json" }).$type<LibraryItemExtra>().notNull().default(sql`'{}'`),
});

export const mangaProgress = sqliteTable("manga_progress", {
    itemLink: text()
        .references(() => libraryItems.link, { onDelete: "cascade" })
        .primaryKey(),
    chapterName: text().notNull(),
    currentPage: integer().default(1).notNull(),
    chaptersRead: text({ mode: "json" }).$type<string[]>().notNull().default([]),
    totalPages: integer().default(0).notNull(),
    // cant be onUpdate because not related
    lastReadAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
});

export const bookProgress = sqliteTable("book_progress", {
    itemLink: text()
        .references(() => libraryItems.link, { onDelete: "cascade" })
        .primaryKey(),
    chapterId: text().notNull(),
    chapterName: text().default("~").notNull(),
    /** CSS selector, elementQueryString */
    position: text().notNull(),
    lastReadAt: integer({ mode: "timestamp_ms" }).notNull(),
});

export const mangaBookmarks = sqliteTable(
    "manga_bookmarks",
    {
        id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
        itemLink: text()
            .references(() => libraryItems.link, { onDelete: "cascade" })
            .notNull(),
        chapterName: text().notNull().default("~"),
        page: integer().notNull(),
        note: text().default(""),
        createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
    },
    (t) => [
        unique("uq_manga_bookmarks_item_chapter_page").on(t.itemLink, t.chapterName, t.page),
        index("idx_manga_bookmarks_item_link").on(t.itemLink),
    ],
);

export const bookBookmarks = sqliteTable(
    "book_bookmarks",
    {
        id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
        itemLink: text()
            .references(() => libraryItems.link, { onDelete: "cascade" })
            .notNull(),
        chapterName: text().notNull().default("~"),
        /** this is id of chapter in the book file */
        chapterId: text().notNull(),
        /** CSS selector, elementQueryString */
        position: text().notNull(),
        // removing title in favor of chapterName because its confusing
        // title: text().notNull(),
        note: text(),
        createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
    },
    (t) => [
        unique("uq_book_bookmarks_chapter_id_position").on(t.chapterId, t.position),
        index("idx_book_bookmarks_item_link").on(t.itemLink),
    ],
);

export const bookNotes = sqliteTable(
    "book_notes",
    {
        id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
        itemLink: text()
            .references(() => libraryItems.link, { onDelete: "cascade" })
            .notNull(),
        /** this is id of chapter in the book file */
        chapterId: text().notNull(),
        /** for display purposes */
        chapterName: text().notNull(),
        range: text({
            mode: "json",
        })
            .$type<{
                startPath: string;
                startOffset: number;
                endPath: string;
                endOffset: number;
            }>()
            .notNull(),
        content: text(),
        selectedText: text().notNull(),
        color: text().notNull(),
        createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
        updatedAt: integer({ mode: "timestamp_ms" })
            .notNull()
            .default(timeNow)
            .$onUpdate(() => new Date()),
    },
    (t) => [
        unique("uq_book_notes_chapter_id_range_selected_text").on(t.chapterId, t.range, t.selectedText),
        index("idx_book_notes_item_link").on(t.itemLink),
    ],
);

/**
 * One tracker binding per library item per provider. `media` and `listState` are cache:
 * the remote service remains the source of truth; {@link itemTrackers.syncedAt} is local staleness.
 */
export const itemTrackers = sqliteTable(
    "item_trackers",
    {
        id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
        itemLink: text()
            .references(() => libraryItems.link, { onDelete: "cascade" })
            .notNull(),
        provider: text({ enum: ["anilist"] }).notNull(),
        /** Provider media id. TEXT so non-integer ids (Kitsu, etc.) fit later. */
        remoteId: text().notNull(),
        /** Provider list-entry id when the service splits media from "my list" (AniList MediaList.id). */
        remoteListId: text(),
        /** Canonical remote page URL, stored rather than rebuilt from a per-provider template. */
        remoteUrl: text(),
        media: text({ mode: "json" }).$type<TrackerMediaSnapshot>(),
        listState: text({ mode: "json" }).$type<TrackerListState>(),
        syncedAt: integer({ mode: "timestamp_ms" }),
        createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
    },
    (t) => [
        unique("uq_item_trackers_item_provider").on(t.itemLink, t.provider),
        index("idx_item_trackers_provider_remote").on(t.provider, t.remoteId),
    ],
);

/**
 * Per-source metadata overlay on a library item. `source = "user"` is written by the details editor;
 * `source = "file"` is reserved for later ComicInfo / EPUB extraction. Null on a field means that
 * source does not supply it (read-time resolution treats null as "fall through").
 */
export const libraryItemMetadata = sqliteTable(
    "library_item_metadata",
    {
        itemLink: text()
            .references(() => libraryItems.link, { onDelete: "cascade" })
            .notNull(),
        source: text({ enum: ["user", "file"] }).notNull(),
        title: text(),
        author: text(),
        description: text(),
        genres: text({ mode: "json" }).$type<string[]>(),
        /**
         * File-derived descriptive tags (ComicInfo later). User organization labels are
         * {@link libraryTags} assigned through {@link libraryItemTags}, not this column.
         */
        tags: text({ mode: "json" }).$type<string[]>(),
        publisher: text(),
        createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
        updatedAt: integer({ mode: "timestamp_ms" })
            .notNull()
            .default(timeNow)
            .$onUpdate(() => new Date()),
    },
    (t) => [primaryKey({ columns: [t.itemLink, t.source] })],
);

/**
 * User-created library tag in the global catalog. Items attach tags by id via {@link libraryItemTags};
 * renaming the row updates every assignment. Names are unique after trim + case-fold (see the unique index).
 */
export const libraryTags = sqliteTable(
    "library_tags",
    {
        id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
        /** Display name as the user typed it after trim. Empty strings are rejected at the IPC boundary. */
        name: text().notNull(),
        /** Chip colour as a CSS hex string. */
        color: text().notNull(),
        createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
    },
    (t) => [uniqueIndex("uq_library_tags_name").on(sql`lower(trim(${t.name}))`)],
);

/**
 * Assignment of one {@link libraryTags} row to one library item. Composite PK so an item cannot hold
 * the same tag twice. Deleting the item or the tag cascade-removes the assignment.
 */
export const libraryItemTags = sqliteTable(
    "library_item_tags",
    {
        itemLink: text()
            .references(() => libraryItems.link, { onDelete: "cascade" })
            .notNull(),
        tagId: integer({ mode: "number" })
            .references(() => libraryTags.id, { onDelete: "cascade" })
            .notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.itemLink, t.tagId] }),
        index("idx_library_item_tags_tag_id").on(t.tagId),
    ],
);

export const libraryItemsRelations = relations(libraryItems, ({ one, many }) => ({
    mangaProgress: one(mangaProgress),
    bookProgress: one(bookProgress),
    mangaBookmarks: many(mangaBookmarks),
    bookBookmarks: many(bookBookmarks),
    bookNotes: many(bookNotes),
    trackers: many(itemTrackers),
    metadata: many(libraryItemMetadata),
    tagAssignments: many(libraryItemTags),
}));

export const mangaProgressRelations = relations(mangaProgress, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [mangaProgress.itemLink],
        references: [libraryItems.link],
    }),
}));

export const bookProgressRelations = relations(bookProgress, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [bookProgress.itemLink],
        references: [libraryItems.link],
    }),
}));

export const mangaBookmarksRelations = relations(mangaBookmarks, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [mangaBookmarks.itemLink],
        references: [libraryItems.link],
    }),
}));

export const bookBookmarksRelations = relations(bookBookmarks, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [bookBookmarks.itemLink],
        references: [libraryItems.link],
    }),
}));

export const bookNotesRelations = relations(bookNotes, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [bookNotes.itemLink],
        references: [libraryItems.link],
    }),
}));

export const itemTrackersRelations = relations(itemTrackers, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [itemTrackers.itemLink],
        references: [libraryItems.link],
    }),
}));

export const libraryItemMetadataRelations = relations(libraryItemMetadata, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [libraryItemMetadata.itemLink],
        references: [libraryItems.link],
    }),
}));

export const libraryTagsRelations = relations(libraryTags, ({ many }) => ({
    assignments: many(libraryItemTags),
}));

export const libraryItemTagsRelations = relations(libraryItemTags, ({ one }) => ({
    libraryItem: one(libraryItems, {
        fields: [libraryItemTags.itemLink],
        references: [libraryItems.link],
    }),
    tag: one(libraryTags, {
        fields: [libraryItemTags.tagId],
        references: [libraryTags.id],
    }),
}));
