import type { ItemTracker, LibraryItem, LibraryItemMetadata, TrackerProvider } from "@common/types/db";

/**
 * Display metadata after applying user > tracker > file > library-item base.
 * Null / empty at a layer means that layer does not supply the field.
 */
export type ResolvedItemMetadata = {
    title: string;
    /**
     * {@link LibraryItem.title} when it differs from {@link ResolvedItemMetadata.title}.
     * Null when the library row is already the primary title.
     */
    originalTitle: string | null;
    /** Unique non-empty titles from every layer, for search haystacks. */
    searchTitles: string[];
    author: string | null;
    description: string | null;
    genres: string[];
    tags: string[];
    publisher: string | null;
    /** Tracker catalog status (releasing / finished), not the user's list-entry status. */
    mediaStatus: string | null;
    /** Tracker catalog score (e.g. AniList average), not the user's list-entry score. */
    mediaScore: number | null;
    mediaFormat: string | null;
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
 * Unique trimmed titles, first-seen order, compared case-insensitively.
 */
const uniqueTitles = (...values: (string | null | undefined)[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const value of values) {
        const trimmed = value?.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
};

/**
 * Resolves display metadata from overlay rows, tracker cache, and {@link LibraryItem} base columns.
 * Tracker catalog fields (`mediaStatus`, `mediaScore`, `mediaFormat`, `totalChapters`) come from
 * the media snapshot only; list-entry state stays on {@link ItemTracker.listState}.
 */
export const resolveItemMetadata = ({
    item,
    overlays,
    tracker,
}: ResolveItemMetadataArgs): ResolvedItemMetadata => {
    const user = overlays.find((row) => row.source === "user");
    const file = overlays.find((row) => row.source === "file");
    const media = tracker?.media;
    const title = firstNonEmpty(user?.title, media?.title, file?.title, item.title) ?? item.title;
    const libraryTitle = item.title.trim();
    const originalTitle =
        libraryTitle && libraryTitle.toLowerCase() !== title.trim().toLowerCase() ? item.title : null;

    return {
        title,
        originalTitle,
        searchTitles: uniqueTitles(user?.title, media?.title, file?.title, item.title),
        author: firstNonEmpty(user?.author, media?.author, file?.author, item.author),
        description: firstNonEmpty(user?.description, media?.description, file?.description),
        genres: firstNonEmptyList(user?.genres, media?.genres, file?.genres),
        tags: firstNonEmptyList(user?.tags, file?.tags),
        publisher: firstNonEmpty(user?.publisher, file?.publisher),
        mediaStatus: firstNonEmpty(media?.status),
        mediaScore: media?.score ?? null,
        mediaFormat: firstNonEmpty(media?.format),
        siteUrl: media?.siteUrl ?? null,
        totalChapters: media?.totalChapters ?? null,
    };
};

type TrackerMediaFacts = Pick<
    ResolvedItemMetadata,
    "mediaStatus" | "mediaScore" | "mediaFormat" | "totalChapters"
>;

/**
 * True when the tracker media snapshot has at least one catalog fact to show on details.
 */
export const hasTrackerMediaFacts = (resolved: TrackerMediaFacts): boolean =>
    Boolean(
        resolved.mediaStatus?.trim() ||
            resolved.mediaFormat?.trim() ||
            resolved.mediaScore != null ||
            resolved.totalChapters != null,
    );

/**
 * Canonical media page URL for a tracker binding from provider slug and remote id.
 * Rebuilds the URL instead of trusting a cached {@link ItemTracker.remoteUrl} so a stale
 * snapshot still opens the right page.
 *
 * @returns null when remote id is empty
 */
export const trackerMediaPageUrl = (
    provider: TrackerProvider,
    remoteId: string | null | undefined,
): string | null => {
    const id = remoteId?.trim();
    if (!id) return null;
    switch (provider) {
        case "anilist":
            return `https://anilist.co/manga/${encodeURIComponent(id)}`;
        default: {
            const _exhaustive: never = provider;
            return _exhaustive;
        }
    }
};

/**
 * Home-gallery `details` label key for the open-on-tracker link above About.
 * Exhaustive on {@link TrackerProvider} so a new provider must add a key here.
 */
export const trackerExternalOpenLabelKey = (provider: TrackerProvider): "gallery.details.openOnAnilist" => {
    switch (provider) {
        case "anilist":
            return "gallery.details.openOnAnilist";
        default: {
            const _exhaustive: never = provider;
            return _exhaustive;
        }
    }
};

/** Provider + remote id for opening the tracker media page from details. */
export type TrackerExternalRef = {
    provider: TrackerProvider;
    remoteId: string;
};

/**
 * Builds a details external-link ref when the tracker row has a non-empty remote id.
 */
export const toTrackerExternalRef = (
    tracker: Pick<ItemTracker, "provider" | "remoteId"> | null | undefined,
): TrackerExternalRef | null => {
    const remoteId = tracker?.remoteId?.trim();
    if (!tracker || !remoteId) return null;
    return { provider: tracker.provider, remoteId };
};

/**
 * Concatenates title layers and caller extras (type tokens, chapter extension) for list search.
 */
export const libraryItemSearchText = (searchTitles: readonly string[], extra = ""): string =>
    `${searchTitles.join(" ")}${extra}`;

/**
 * First tracker row per library path.
 * ponytail: first row wins until a provider picker exists.
 */
export const trackerByItemLink = (entries: readonly ItemTracker[]): Record<string, ItemTracker> => {
    const map: Record<string, ItemTracker> = {};
    for (const row of entries) {
        if (!map[row.itemLink]) map[row.itemLink] = row;
    }
    return map;
};

/**
 * Resolves display metadata for every item, keyed by {@link LibraryItem.link}.
 */
export const resolveAllItemMetadata = (
    items: Iterable<Pick<LibraryItem, "link" | "title" | "author">>,
    metadataByLink: Record<string, LibraryItemMetadata[] | undefined>,
    trackerByLink: Record<string, ItemTracker | undefined>,
): Record<string, ResolvedItemMetadata> => {
    const out: Record<string, ResolvedItemMetadata> = {};
    for (const item of items) {
        out[item.link] = resolveItemMetadata({
            item,
            overlays: metadataByLink[item.link] ?? [],
            tracker: trackerByLink[item.link],
        });
    }
    return out;
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
