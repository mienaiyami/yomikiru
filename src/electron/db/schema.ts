import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, unique } from "drizzle-orm/sqlite-core";

// todo : add relations

export const libraryItems = sqliteTable("library_items", {
    /** link of manga/epub , not a chapter */
    link: text().primaryKey(),
    type: text({ enum: ["manga", "book"] }).notNull(),
    title: text().notNull(),
    updatedAt: integer({ mode: "timestamp_ms" })
        .notNull()
        .default(sql`(unixepoch() * 1000)`)
        .$onUpdate(() => sql`(unixepoch() * 1000)`),
    createdAt: integer({ mode: "timestamp_ms" })
        .notNull()
        .default(sql`(unixepoch() * 1000)`),
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
    chaptersRead: text({ mode: "json" }).$type<string[]>().notNull(),
    totalPages: integer(),
    lastReadAt: integer({ mode: "timestamp_ms" }).notNull(),
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
        page: integer().notNull(),
        link: text().notNull(),
        note: text().default(""),
        createdAt: integer({ mode: "timestamp_ms" })
            .notNull()
            .default(sql`(unixepoch() * 1000)`),
    },
    (t) => [unique().on(t.link, t.page)]
);

export const bookBookmarks = sqliteTable(
    "book_bookmarks",
    {
        id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
        itemLink: text()
            .references(() => libraryItems.link, { onDelete: "cascade" })
            .notNull(),
        /** this is id of chapter in the epub file */
        chapterId: text().notNull(),
        /** CSS selector, elementQueryString */
        position: text().notNull(),
        title: text().notNull(),
        note: text(),
        createdAt: integer({ mode: "timestamp_ms" })
            .notNull()
            .default(sql`(unixepoch() * 1000)`),
    },
    (t) => [unique().on(t.chapterId, t.position)]
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
        /** CSS selector, elementQueryString */
        position: text().notNull(),
        content: text().notNull(),
        selectedText: text().notNull(),
        color: text().notNull(),
        createdAt: integer({ mode: "timestamp_ms" })
            .notNull()
            .default(sql`(unixepoch() * 1000)`),
        updatedAt: integer({ mode: "timestamp_ms" })
            .notNull()
            .default(sql`(unixepoch() * 1000)`)
            .$onUpdate(() => sql`(unixepoch() * 1000)`),
    },
    (t) => [unique().on(t.chapterId, t.position, t.selectedText)]
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
