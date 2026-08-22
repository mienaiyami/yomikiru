import { HttpStatusError, http } from "@common/http";
import type { TrackerListState, TrackerMediaSnapshot, UpdateTrackerSnapshotData } from "@common/types/db";
import i18n from "@renderer/i18n";
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
            medium
            large
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
 * Every window must call this so GraphQL has a bearer; token check is once per app.
 */
export const hydrateAnilistClientFromStorage = (): void => {
    ensureAnilistNs();
    if (getAnilistStorageToken() === null) setAnilistStorageToken("");
    setAnilistClientToken(getAnilistStorageToken() || "");
};

/**
 * Loads the stored token and validates it with AniList. Call once per app
 * (first window to claim `anilist:claimStartupImport`).
 */
export const initAnilist = (): void => {
    hydrateAnilistClientFromStorage();
    const stored = getAnilistStorageToken() || "";
    if (!stored) return;
    void checkAnilistToken(stored).then((ok) => {
        if (!ok && ok !== undefined)
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
 * Maps an AniList media payload to the provider-agnostic tracker snapshot stored in the DB.
 */
export const toTrackerMediaSnapshot = (media: Anilist.ListEntry["media"]): TrackerMediaSnapshot => ({
    title: media.title.english || media.title.romaji || media.title.native,
    author: authorFromAnilistStaff(media.staff),
    coverImage: media.coverImage.large || media.coverImage.medium,
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
 * Validates a bearer token and loads the viewer's adult-content preference.
 * @returns true on 2xx, false on HTTP error, undefined on network failure
 */
export const checkAnilistToken = async (bearer: string): Promise<boolean | undefined> => {
    const query = `#graphql
    query{
        Viewer{
                name
                options{
                    displayAdultContent
                }
        }
    }
    `;
    try {
        const json = await postAnilistGraphql(bearer, { query });
        if (json && typeof json === "object" && "data" in json) {
            const data = (json as { data?: AnilistGraphqlData }).data;
            displayAdultContent = Boolean(data?.Viewer?.options?.displayAdultContent);
        }
        return true;
    } catch (reason) {
        if (reason instanceof HttpStatusError) {
            return false;
        }
        dialogUtils.customError({ message: i18n.t("errors.requestFailed", { ns: "anilist" }) });
        log.error("checkAnilistToken: request failed", reason);
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

/** Returns the logged-in AniList username, or a localized fallback when the request fails. */
export const getAnilistUserName = async (): Promise<string> => {
    const query = `#graphql
        query{
            Viewer{
                    name
            }
        }
        `;
    const data = await anilistRequest(query);
    if (data?.Viewer?.name) return data.Viewer.name;
    return i18n.t("errors.username", { ns: "anilist" });
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
                        medium
                        large
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
