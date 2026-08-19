import type { ItemTracker, LibraryItem, LibraryItemMetadata } from "@common/types/db";

/**
 * Display metadata after applying user > tracker > file > library-item base.
 * Null / empty at a layer means that layer does not supply the field.
 */
export type ResolvedItemMetadata = {
    title: string;
    author: string | null;
    description: string | null;
    genres: string[];
    tags: string[];
    publisher: string | null;
    status: string | null;
    score: number | null;
    siteUrl: string | null;
    totalChapters: number | null;
};

type ResolveItemMetadataArgs = {
    item: Pick<LibraryItem, "title" | "author">;
    overlays: readonly LibraryItemMetadata[];
    tracker?: ItemTracker | null;
};

const firstNonEmpty = (...values: (string | null | undefined)[]): string | null => {
    for (const value of values) {
        if (value != null && value !== "") return value;
    }
    return null;
};

const firstNonEmptyList = (...values: (string[] | null | undefined)[]): string[] => {
    for (const value of values) {
        if (value && value.length > 0) return value;
    }
    return [];
};

/**
 * Resolves display metadata from overlay rows, tracker cache, and {@link LibraryItem} base columns.
 * Tracker-only fields have no file/user overlay columns.
 */
export const resolveItemMetadata = ({
    item,
    overlays,
    tracker,
}: ResolveItemMetadataArgs): ResolvedItemMetadata => {
    const user = overlays.find((row) => row.source === "user");
    const file = overlays.find((row) => row.source === "file");
    const media = tracker?.media;
    const listState = tracker?.listState;

    return {
        title: firstNonEmpty(user?.title, media?.title, file?.title, item.title) ?? item.title,
        author: firstNonEmpty(user?.author, media?.author, file?.author, item.author),
        description: firstNonEmpty(user?.description, media?.description, file?.description),
        genres: firstNonEmptyList(user?.genres, media?.genres, file?.genres),
        tags: firstNonEmptyList(user?.tags, file?.tags),
        publisher: firstNonEmpty(user?.publisher, file?.publisher),
        status: firstNonEmpty(listState?.status, media?.status),
        score: listState?.score ?? media?.score ?? null,
        siteUrl: media?.siteUrl ?? null,
        totalChapters: media?.totalChapters ?? null,
    };
};

/**
 * Splits a comma-separated genre string from the metadata editor into trimmed unique-enough tokens.
 */
export const parseGenreList = (raw: string): string[] =>
    raw
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

/** Joins genres for the metadata editor input. */
export const formatGenreList = (genres: string[]): string => genres.join(", ");
