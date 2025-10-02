import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { bookBookmarks, bookNotes, bookProgress, libraryItems, mangaBookmarks, mangaProgress } from "./schema";

export const LibraryItemSchema = createInsertSchema(libraryItems).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const BookProgressSchema = createInsertSchema(bookProgress).omit({
    lastReadAt: true,
    itemLink: true,
});

export const MangaProgressSchema = createInsertSchema(mangaProgress).omit({
    chaptersRead: true,
    lastReadAt: true,
    itemLink: true,
});

export const AddToLibrarySchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("book"),
        data: LibraryItemSchema.extend({ type: z.literal("book") }),
        progress: BookProgressSchema,
    }),
    z.object({
        type: z.literal("manga"),
        data: LibraryItemSchema.extend({ type: z.literal("manga") }),
        progress: MangaProgressSchema,
    }),
]);

export const AddMangaBookmarkSchema = createInsertSchema(mangaBookmarks).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const AddBookBookmarkSchema = createInsertSchema(bookBookmarks).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const AddBookNoteSchema = createInsertSchema(bookNotes).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export const UpdateMangaProgressSchema = createUpdateSchema(mangaProgress)
    .omit({
        lastReadAt: true,
    })
    .required({
        itemLink: true,
    })
    .extend({
        chaptersRead: z.array(z.string()).optional(),
    });

export const UpdateBookProgressSchema = createUpdateSchema(bookProgress)
    .omit({
        lastReadAt: true,
    })
    .required({
        itemLink: true,
    });
