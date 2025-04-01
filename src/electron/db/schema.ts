import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, unique, index } from "drizzle-orm/sqlite-core";

// todo : add relations

const timeNow = sql`(unixepoch() * 1000)`;

export const libraryItems = sqliteTable("library_items", {
    /** link of manga/epub , not a chapter */
    link: text().primaryKey(),
    type: text({ enum: ["manga", "book"] }).notNull(),
    title: text().notNull(),
    updatedAt: integer({ mode: "timestamp_ms" })
        .notNull()
        .default(timeNow)
        .$onUpdate(() => new Date()),
    createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
    author: text(),
    cover: text(),
});

export const mangaProgress = sqliteTable("manga_progress", {
    itemLink: text()
        .references(() => libraryItems.link, { onDelete: "cascade" })
        .primaryKey(),
    chapterName: text().notNull(),
    chapterLink: text().notNull(),
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
        link: text().notNull(),
        note: text().default(""),
        createdAt: integer({ mode: "timestamp_ms" }).notNull().default(timeNow),
    },
    (t) => [
        unique("uq_manga_bookmarks_link_page").on(t.link, t.page),
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
        /** this is id of chapter in the epub file */
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
        /** this is id of chapter in the epub file */
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

export const libraryItemsRelations = relations(libraryItems, ({ one, many }) => ({
    mangaProgress: one(mangaProgress),
    bookProgress: one(bookProgress),
    mangaBookmarks: many(mangaBookmarks),
    bookBookmarks: many(bookBookmarks),
    bookNotes: many(bookNotes),
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
