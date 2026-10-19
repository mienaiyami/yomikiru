import { HttpNetworkError, HttpStatusError, http } from "@common/http";
import type { TrackerListState, TrackerMediaSnapshot, UpdateTrackerSnapshotData } from "@common/types/db";
import i18n from "@renderer/i18n";
import { hexToSvgDataUri } from "./color";
import { dialogUtils } from "./dialog";
import { getStorageItem, setStorageItem } from "./localStorage";
import { createRendererLogger } from "./logger";

/**
 * AniList GraphQL client and OAuth token helpers.
 * Persist tracker rows through `store/trackers.ts` (`trackers.md`). Mapping helpers
 * {@link toTrackerMediaSnapshot} / {@link toTrackerListState} /
 * {@link toAnilistTrackerSnapshotUpdate} belong here because they know the GraphQL shape.
 */

const log = createRendererLogger("AniList");

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

/** Viewer fields that establish the AniList session preferences for a renderer. */
const ANILIST_VIEWER_QUERY = `#graphql
    query {
        Viewer {
            name
            options {
                displayAdultContent
            }
        }
    }
`;

let displayAdultContent = false;
let anilistListEntryId: number | null = null;

const SAVE_MEDIA_LIST_ENTRY = `#graphql
    mutation($mediaId: Int, $id: Int,$status:MediaListStatus, $score:Float, $progress:Int, $repeat:Int, $startedAt: FuzzyDateInput, $completedAt:FuzzyDateInput, $progressVolumes:Int, $private:Boolean){
      SaveMediaListEntry(mediaId:$mediaId, id:$id,status:$status, score:$score,  progress:$progress,  repeat:$repeat,  startedAt:$startedAt,   completedAt:$completedAt, progressVolumes:$progressVolumes, private:$private  ){
        id
        mediaId
        status
        progress
        progressVolumes
        score
        repeat
        private
        startedAt{
            year
            month
            day
        }
        completedAt{
            year
            month
            day
        }
        media{
          idMal
          title{
            english
            romaji
            native
          }
          coverImage{
            extraLarge
            large
            medium
            color
          }
          bannerImage
          siteUrl
          description
          genres
          chapters
          volumes
          averageScore
          status(version: 2)
          format
          staff {
            edges {
              role
              node {
                name {
                  full
                }
              }
            }
          }
        }
      }
    }
    `;

/**
 * POSTs a GraphQL operation to AniList with the given bearer token.
 *
 * @throws {HttpStatusError} when status is outside 2xx
 * @throws {HttpMediaTypeError} when a 2xx body is HTML
 * @throws {HttpNetworkError} when the request fails without a status
 */
const postAnilistGraphql = async (
    bearer: string,
    payload: { query: string; variables?: object },
): Promise<unknown> =>
    http.postJson(ANILIST_GRAPHQL_URL, payload, {
        headers: {
            Authorization: `Bearer ${bearer}`,
            Accept: "application/json",
        },
    });

/** GraphQL `data` fields used by this module's operations. */
type AnilistGraphqlData = {
    Viewer?: {
        name?: string;
        options?: { displayAdultContent?: boolean };
    };
    Page?: {
        media?: Anilist.SearchMediaItem[] | null;
    };
    SaveMediaListEntry?: Anilist.ListEntry;
};

/** AniList profile fields shared by token validation and the Settings account label. */
type AnilistViewer = NonNullable<AnilistGraphqlData["Viewer"]>;

/**
 * Result of a Viewer probe. `unauthorized` is a rejected token; `unavailable` is offline, 5xx, or a malformed body.
 */
export type AnilistViewerLookup =
    | { ok: true; viewer: AnilistViewer }
    | { ok: false; reason: "unauthorized" | "unavailable" };

/** True when AniList rejected the bearer (HTTP 401/403 or GraphQL Invalid token). */
const isAnilistUnauthorized = (reason: unknown): boolean => {
    if (!(reason instanceof HttpStatusError)) return false;
    if (reason.status === 401 || reason.status === 403) return true;
    const errors =
        reason.data && typeof reason.data === "object" && "errors" in reason.data
            ? (reason.data as { errors?: { message?: string } }).errors
            : undefined;
    return errors?.message === "Invalid token";
};

/** Ensures the lazy `anilist` catalog is available before util dialogs / labels run. */
const ensureAnilistNs = (): void => {
    void i18n.loadNamespaces("anilist");
};

/** Stored AniList OAuth token, or null when the key is empty / missing. */
export const getAnilistStorageToken = (): string | null => {
    const value = getStorageItem("ANILIST_TOKEN");
    return value || null;
};

/** Persists the AniList OAuth token. Empty string is a logged-out token. */
export const setAnilistStorageToken = (value: string): void => {
    setStorageItem("ANILIST_TOKEN", value);
};

/*
 * In-memory bearer used by GraphQL calls. Seeded from localStorage so Settings
 * (always mounted) can request before App's initAnilist effect runs.
 */
let token = getAnilistStorageToken() || "";

/**
 * Bearer for GraphQL: in-memory session first, then persisted token.
 * Settings username fetch runs in a child effect before {@link initAnilist}.
 */
const resolveAnilistBearer = (): string => {
    if (token) return token;
    const stored = getAnilistStorageToken() || "";
    if (stored) token = stored;
    return stored;
};

/**
 * Loads the stored token into module state. Does not validate it.
 * Every window must call this so GraphQL has a bearer; network token check is once per process.
 */
export const hydrateAnilistClientFromStorage = (): void => {
    ensureAnilistNs();
    if (getAnilistStorageToken() === null) setAnilistStorageToken("");
    setAnilistClientToken(getAnilistStorageToken() || "");
};

/**
 * Loads the stored token and validates it with AniList.
 * Call once per Electron process (from the anilist store legacy-startup claim).
 */
export const initAnilist = (): void => {
    hydrateAnilistClientFromStorage();
    const stored = getAnilistStorageToken() || "";
    if (!stored) return;
    void getAnilistViewer(stored).then((result) => {
        if (result.ok) return;
        if (result.reason !== "unauthorized") return;
        dialogUtils.customError({
            message: i18n.t("errors.loginFailed", { ns: "anilist" }),
        });
    });
};

/** Loads the stored token into module state. Does not validate it. */
export const setAnilistClientToken = (value: string): void => {
    token = value;
};

/** Sets the MediaList entry id used by progress / edit mutations. */
export const setAnilistListEntryId = (id: null | number): void => {
    anilistListEntryId = id;
};

/**
 * Reads the legacy localStorage tracking list. Used only by the one-shot DB import.
 * Does not filter by disk existence; the import matches against `library_items.link`.
 */
export const readStoredTracking = (): Anilist.TrackStore => {
    try {
        return JSON.parse(getStorageItem("ANILIST_TRACKING") || "[]") as Anilist.TrackStore;
    } catch (e) {
        log.error("readStoredTracking: invalid JSON or read error; treating as empty", e);
        return [];
    }
};

/**
 * Picks a display author from AniList staff edges.
 * Prefers roles whose name includes Story or Creator; otherwise uses named staff.
 */
export const authorFromAnilistStaff = (staff: Anilist.ListEntry["media"]["staff"]): string | null => {
    const edges = staff?.edges ?? [];
    const namesFor = (list: typeof edges): string[] => {
        const names: string[] = [];
        const seen = new Set<string>();
        for (const edge of list) {
            const name = edge?.node?.name?.full?.trim();
            if (!name || seen.has(name)) continue;
            seen.add(name);
            names.push(name);
        }
        return names;
    };
    const preferred = edges.filter((edge) => {
        const role = edge?.role ?? "";
        return /story/i.test(role) || /creator/i.test(role);
    });
    const names = namesFor(preferred.length > 0 ? preferred : edges);
    return names.length > 0 ? names.join(", ") : null;
};

/**
 * First non-empty trimmed URL in `urls`, or `null`.
 */
const firstTrimmedUrl = (urls: readonly (string | null | undefined)[]): string | null => {
    for (const url of urls) {
        const trimmed = url?.trim();
        if (trimmed) return trimmed;
    }
    return null;
};

/**
 * Solid SVG from {@link Anilist.CoverImage} `color`, or `null`.
 */
const anilistCoverColorSrc = (cover: Anilist.CoverImage): string | null => {
    const color = cover.color?.trim();
    return color ? hexToSvgDataUri(color) : null;
};

/**
 * Resolves a cover image source from AniList {@link Anilist.CoverImage} for snapshot storage
 * and gallery/details materialize. Prefers extraLarge, then large, then medium; otherwise `color`.
 *
 * @returns Raster URL or {@link hexToSvgDataUri} result, or `null` when none of those are usable
 */
export const anilistCoverImageSrc = (cover: Anilist.CoverImage): string | null =>
    firstTrimmedUrl([cover.extraLarge, cover.large, cover.medium]) ?? anilistCoverColorSrc(cover);

/**
 * Cover URL for AniList search and edit overlays. Prefers large, then medium; otherwise `color`.
 * Does not use `extraLarge` (gallery/details materialize use {@link anilistCoverImageSrc}).
 */
export const anilistOverlayCoverSrc = (cover: Anilist.CoverImage): string | null =>
    firstTrimmedUrl([cover.large, cover.medium]) ?? anilistCoverColorSrc(cover);

/**
 * Maps an AniList media payload to the provider-agnostic tracker snapshot stored in the DB.
 */
export const toTrackerMediaSnapshot = (media: Anilist.ListEntry["media"]): TrackerMediaSnapshot => ({
    title: media.title.english || media.title.romaji || media.title.native,
    author: authorFromAnilistStaff(media.staff),
    coverImage: anilistCoverImageSrc(media.coverImage),
    bannerImage: media.bannerImage,
    description: media.description ?? null,
    genres: media.genres,
    status: media.status ?? null,
    format: media.format ?? null,
    totalChapters: media.chapters ?? null,
    siteUrl: media.siteUrl,
    score: media.averageScore ?? null,
});

/**
 * Maps list-entry fields to the cached tracker list state.
 */
export const toTrackerListState = (data: Anilist.ListEntry): TrackerListState => ({
    status: data.status,
    progress: data.progress,
    progressVolumes: data.progressVolumes,
    score: data.score,
});

/**
 * Maps a GraphQL list entry to {@link UpdateTrackerSnapshotData} for the AniList provider.
 */
export const toAnilistTrackerSnapshotUpdate = (
    itemLink: string,
    data: Anilist.ListEntry,
): UpdateTrackerSnapshotData => ({
    itemLink,
    provider: "anilist",
    remoteListId: String(data.id),
    remoteUrl: data.media.siteUrl,
    media: toTrackerMediaSnapshot(data.media),
    listState: toTrackerListState(data),
    syncedAt: new Date(),
});

/**
 * Fetches the AniList viewer and applies account preferences to this renderer.
 * Pass a bearer while validating a newly entered token; otherwise the current session token is used.
 * Does not open a dialog: offline, timeouts, and non-auth HTTP statuses are `unavailable`.
 *
 * @returns Discriminated lookup; {@link initAnilist} only warns on `unauthorized`
 */
export const getAnilistViewer = async (bearer = resolveAnilistBearer()): Promise<AnilistViewerLookup> => {
    if (!bearer) {
        log.error("getAnilistViewer: skipped (no access token; user not logged in)");
        return { ok: false, reason: "unavailable" };
    }
    try {
        const json = await postAnilistGraphql(bearer, { query: ANILIST_VIEWER_QUERY });
        if (json && typeof json === "object" && "data" in json) {
            const data = (json as { data?: AnilistGraphqlData }).data;
            const viewer = data?.Viewer;
            if (viewer) {
                displayAdultContent = Boolean(viewer.options?.displayAdultContent);
                return { ok: true, viewer };
            }
        }
        return { ok: false, reason: "unavailable" };
    } catch (reason) {
        if (isAnilistUnauthorized(reason)) {
            log.error("getAnilistViewer: unauthorized", reason);
            return { ok: false, reason: "unauthorized" };
        }
        if (reason instanceof HttpNetworkError || reason instanceof HttpStatusError) {
            log.error("getAnilistViewer: AniList unreachable or non-auth HTTP error", reason);
            return { ok: false, reason: "unavailable" };
        }
        log.error("getAnilistViewer: request failed", reason);
        return { ok: false, reason: "unavailable" };
    }
};

/**
 * Runs a GraphQL operation against AniList and returns the envelope `data` field on 2xx.
 * Uses the in-memory session token, then the persisted token, so a login is enough
 * even before {@link initAnilist}. HTTP errors are logged; an invalid-token payload shows a dialog.
 */
export const anilistRequest = async (query: string, variables = {}): Promise<AnilistGraphqlData | undefined> => {
    const bearer = resolveAnilistBearer();
    if (!bearer) {
        log.error("request: skipped (no access token; user not logged in)");
        return;
    }
    try {
        const json = await postAnilistGraphql(bearer, { query, variables });
        if (json && typeof json === "object" && "data" in json) {
            return (json as { data: AnilistGraphqlData }).data;
        }
    } catch (reason) {
        if (reason instanceof HttpStatusError) {
            log.error("request: GraphQL HTTP error", {
                status: reason.status,
                statusText: reason.statusText,
                data: reason.data,
            });
            const errors =
                reason.data && typeof reason.data === "object" && "errors" in reason.data
                    ? (reason.data as { errors?: { message?: string } }).errors
                    : undefined;
            if (errors?.message === "Invalid token")
                dialogUtils.customError({
                    message: i18n.t("errors.invalidToken", { ns: "anilist" }),
                    detail: i18n.t("errors.invalidTokenDetail", { ns: "anilist" }),
                });
            return;
        }
        log.error("request: network or parse error", reason);
    }
};

const withAdultContentVariable = (variables: object): object =>
    displayAdultContent ? { ...variables } : { ...variables, displayAdultContent: false };

/**
 * Search AniList media by title. GraphQL `type: MANGA` includes novels and other
 * print formats; it is AniList's enum, not the app library type `"manga"`.
 * @param name search term in `English` or `Romaji`
 * @returns media items, excludes unreleased
 */
export const searchAnilistMedia = async (name: string): Promise<Anilist.SearchMediaItem[]> => {
    if (!name) return [];
    const query = `#graphql
        query($search: String,$displayAdultContent: Boolean){
            Page(page: 1, perPage: 20){
                media(search: $search, type: MANGA, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult:$displayAdultContent ){
                    id
                    idMal
                    title{
                      english
                      romaji
                      native
                    }
                    startDate{
                        year
                        month
                        day
                    }
                    format
                    coverImage{
                        large
                        medium
                        color
                    }
                    bannerImage
                    siteUrl
                    description
                    genres
                    chapters
                    volumes
                    averageScore
                    status(version: 2)
                }
            }
        }
        `;
    const data = await anilistRequest(query, withAdultContentVariable({ search: name }));
    if (data) return (data.Page?.media ?? []) as Anilist.SearchMediaItem[];
    return [];
};

/** Creates or fetches the user's MediaList entry for an AniList media id. */
export const getAnilistListEntry = async (mediaId: number): Promise<Anilist.ListEntry | undefined> => {
    const data = await anilistRequest(SAVE_MEDIA_LIST_ENTRY, withAdultContentVariable({ mediaId }));
    if (data?.SaveMediaListEntry) {
        return data.SaveMediaListEntry;
    }
};

/** Saves list-entry fields (status, score, progress, dates) for the current MediaList id. */
export const setAnilistListEntry = async (
    newData: Omit<Anilist.ListEntry, "id" | "mediaId" | "media">,
): Promise<Anilist.ListEntry | undefined> => {
    if (!anilistListEntryId) {
        log.error("setAnilistListEntry: anilistListEntryId missing; cannot save list entry");
        return;
    }
    const data = await anilistRequest(
        SAVE_MEDIA_LIST_ENTRY,
        withAdultContentVariable({ id: anilistListEntryId, ...newData }),
    );
    if (data?.SaveMediaListEntry) {
        return data.SaveMediaListEntry;
    }
};

/** Updates only the chapter/volume progress count on the current MediaList entry. */
export const setAnilistListProgress = async (
    progress: Anilist.ListEntry["progress"],
): Promise<Anilist.ListEntry | undefined> => {
    if (!anilistListEntryId) {
        log.error("setAnilistListProgress: anilistListEntryId missing; cannot sync progress");
        return;
    }
    const data = await anilistRequest(
        SAVE_MEDIA_LIST_ENTRY,
        withAdultContentVariable({ id: anilistListEntryId, progress }),
    );
    if (data?.SaveMediaListEntry) {
        return data.SaveMediaListEntry;
    }
};

/**
 * Human-readable label for a tracker/AniList media format value.
 * Unknown strings pass through as the i18n defaultValue.
 */
export const anilistFormatLabel = (format: string): string =>
    i18n.t(`format.${format}`, { ns: "anilist", defaultValue: format });

/**
 * Human-readable label for a tracker/AniList media status value.
 * Unknown strings pass through as the i18n defaultValue.
 */
export const anilistStatusLabel = (status: string): string =>
    i18n.t(`status.${status}`, { ns: "anilist", defaultValue: status });
