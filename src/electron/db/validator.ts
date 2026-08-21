import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import {
    bookBookmarks,
    bookNotes,
    bookProgress,
    itemTrackers,
    libraryItemMetadata,
    libraryItems,
    libraryTags,
    mangaBookmarks,
    mangaProgress,
} from "./schema";

export const LibraryItemSchema = createInsertSchema(libraryItems).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    favouritedAt: true,
    note: true,
    extra: true,
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

/**
 * Insert payload for a catalogue row. `progress` is required when the reader opens a title;
 * scan/import omit it so Continue Reading stays empty until a real read.
 */
export const AddToLibrarySchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("book"),
        data: LibraryItemSchema.extend({ type: z.literal("book") }),
        progress: BookProgressSchema.optional(),
    }),
    z.object({
        type: z.literal("manga"),
        data: LibraryItemSchema.extend({ type: z.literal("manga") }),
        progress: MangaProgressSchema.optional(),
    }),
]);

export const UpdateLibraryItemSchema = createUpdateSchema(libraryItems, {
    /** Coerced because IPC JSON turns Date into an ISO string. */
    favouritedAt: z.coerce.date().nullable().optional(),
    extra: z.record(z.unknown()).optional(),
})
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true,
        type: true,
    })
    .required({
        link: true,
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

/*
 * Nested JSON on item_trackers is not a drizzle table, so drizzle-zod cannot emit
 * this object from `$type<>()`. Row schemas below wrap it via createInsertSchema /
 * createUpdateSchema refinements.
 */
const trackerMediaSnapshotSchema = z.object({
    title: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    coverImage: z.string().nullable().optional(),
    bannerImage: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    genres: z.array(z.string()).optional(),
    status: z.string().nullable().optional(),
    format: z.string().nullable().optional(),
    totalChapters: z.number().nullable().optional(),
    siteUrl: z.string().nullable().optional(),
    score: z.number().nullable().optional(),
});

const trackerListStateSchema = z.object({
    status: z.string().nullable().optional(),
    progress: z.number().nullable().optional(),
    progressVolumes: z.number().nullable().optional(),
    score: z.number().nullable().optional(),
});

/** Insert or replace a tracker row for one library item and provider. */
export const UpsertItemTrackerSchema = createInsertSchema(itemTrackers, {
    itemLink: z.string().min(1),
    remoteId: z.string().min(1),
    media: trackerMediaSnapshotSchema.nullable().optional(),
    listState: trackerListStateSchema.nullable().optional(),
    syncedAt: z.coerce.date().nullable().optional(),
}).omit({
    id: true,
    createdAt: true,
});

/** Identifies one tracker row to delete: library path plus provider slug. */
export const RemoveItemTrackerSchema = createInsertSchema(itemTrackers, {
    itemLink: z.string().min(1),
}).pick({
    itemLink: true,
    provider: true,
});

/** Partial cache refresh; omitted fields stay as stored. */
export const UpdateTrackerSnapshotSchema = createUpdateSchema(itemTrackers, {
    itemLink: z.string().min(1),
    media: trackerMediaSnapshotSchema.nullable().optional(),
    listState: trackerListStateSchema.nullable().optional(),
    syncedAt: z.coerce.date().optional(),
})
    .pick({
        itemLink: true,
        provider: true,
        media: true,
        listState: true,
        remoteListId: true,
        remoteUrl: true,
        syncedAt: true,
    })
    .required({
        itemLink: true,
        provider: true,
    });

/**
 * Patch one metadata overlay. Omitted keys stay as stored; explicit `null` clears that field.
 */
export const SetLibraryItemMetadataSchema = createInsertSchema(libraryItemMetadata, {
    itemLink: z.string().min(1),
    genres: z.array(z.string()).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
}).omit({
    createdAt: true,
    updatedAt: true,
});

/** CSS hex (`#` plus six hex digits) stored on {@link libraryTags.color}. */
const cssHexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

/** Create a catalog tag. `name` is trimmed; uniqueness is enforced by the SQLite index. */
export const CreateLibraryTagSchema = createInsertSchema(libraryTags, {
    name: z.string().trim().min(1),
    color: cssHexColor,
}).omit({
    id: true,
    createdAt: true,
});

/**
 * Patch a catalog tag. Omitted keys stay as stored. At least one of `name` / `color` is required.
 */
export const UpdateLibraryTagSchema = z
    .object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1).optional(),
        color: cssHexColor.optional(),
    })
    .refine((data) => data.name !== undefined || data.color !== undefined, {
        message: "At least one field besides id is required",
    });

/** Identifies one catalog tag to delete. Assignments cascade in SQLite. */
export const DeleteLibraryTagSchema = z.object({
    id: z.number().int().positive(),
});

/**
 * Replace-set of catalog tag ids on one library item. Empty `tagIds` clears all assignments.
 * Duplicate ids are accepted and should be uniqued by the handler.
 */
export const SetLibraryItemTagsSchema = z.object({
    itemLink: z.string().min(1),
    tagIds: z.array(z.number().int().positive()),
});
