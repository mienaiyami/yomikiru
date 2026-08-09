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

export const UpdateLibraryItemSchema = z.object({
    link: z.string(),
    title: z.string().optional(),
    cover: z.string().nullable().optional(),
    author: z.string().optional(),
});

/** Rewrites a library row's path and every child `itemLink` FK to the new location. */
export const RelocateLibraryItemSchema = z.object({
    oldLink: z.string().min(1),
    newLink: z.string().min(1),
});

export const AddMangaBookmarkSchema = createInsertSchema(mangaBookmarks).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

/**
 * Partial manga bookmark update. `id` is required; every other column is optional.
 * At least one mutable field must be present.
 */
export const UpdateMangaBookmarkSchema = createUpdateSchema(mangaBookmarks)
    .omit({ createdAt: true })
    .required({ id: true })
    .refine(
        (data) =>
            data.itemLink !== undefined ||
            data.chapterName !== undefined ||
            data.page !== undefined ||
            data.note !== undefined,
        { message: "At least one field besides id is required" },
    );

export const AddBookBookmarkSchema = createInsertSchema(bookBookmarks).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

/**
 * Partial book bookmark update. `id` is required; every other column is optional.
 * At least one mutable field must be present.
 */
export const UpdateBookBookmarkSchema = createUpdateSchema(bookBookmarks)
    .omit({ createdAt: true })
    .required({ id: true })
    .refine(
        (data) =>
            data.itemLink !== undefined ||
            data.chapterName !== undefined ||
            data.chapterId !== undefined ||
            data.position !== undefined ||
            data.note !== undefined,
        { message: "At least one field besides id is required" },
    );

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
