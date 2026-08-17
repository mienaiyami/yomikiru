import { http, HttpStatusError } from "@common/http";
import i18n from "@renderer/i18n";
import { dialogUtils } from "./dialog";
import { getStorageItem, setStorageItem } from "./localStorage";
import { createRendererLogger } from "./logger";

const log = createRendererLogger("AniList");

const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

/**
 * POSTs a GraphQL operation to AniList with the given bearer token.
 *
 * @throws {HttpStatusError} when status is outside 2xx
 * @throws {HttpMediaTypeError} when a 2xx body is HTML
 * @throws {HttpNetworkError} when the request fails without a status
 */
const postAnilistGraphql = async (
    token: string,
    payload: { query: string; variables?: object },
): Promise<unknown> =>
    http.postJson(ANILIST_GRAPHQL_URL, payload, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
        },
    });

/** GraphQL `data` fields used by this class's operations. */
type AnilistGraphqlData = {
    Viewer?: {
        name?: string;
        options?: { displayAdultContent?: boolean };
    };
    Page?: {
        media?: Anilist.SearchMediaItem[] | null;
    };
    SaveMediaListEntry?: Anilist.MangaData;
};

/** Ensures the lazy `anilist` catalog is available before util dialogs / labels run. */
const ensureAnilistNs = (): void => {
    void i18n.loadNamespaces("anilist");
};

export default class AniList {
    static #token = "";
    static displayAdultContent = false;
    static #currentMangaListId = null as null | number;
    static #mutation = `#graphql
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
          title{
            english
            romaji
            native
          }
          coverImage{
            medium
          }
          bannerImage
          siteUrl
        }
      }
    }
    `;

    static {
        ensureAnilistNs();
        // for first launch
        if (AniList.getStorageToken() === null) AniList.setStorageToken("");
        if (AniList.loadTrackingFromStorage().length === 0) AniList.setStorageTracking([]);

        const token = AniList.getStorageToken() || "";
        AniList.#token = token;
        if (token)
            AniList.checkToken(token).then((e) => {
                if (!e && e !== undefined)
                    dialogUtils.customError({
                        message: i18n.t("errors.loginFailed", { ns: "anilist" }),
                    });
            });
    }
    private constructor() {
        throw new Error("Cannot instantiate static class");
    }
    static setToken(token: string) {
        AniList.#token = token;
    }

    static getStorageToken(): string | null {
        const value = getStorageItem("ANILIST_TOKEN");
        return value || null;
    }

    static setStorageToken(token: string) {
        setStorageItem("ANILIST_TOKEN", token);
    }

    static setStorageTracking(tracking: Anilist.TrackStore) {
        setStorageItem("ANILIST_TRACKING", JSON.stringify(tracking));
    }

    static loadTrackingFromStorage(): Anilist.TrackStore {
        try {
            const tracking = JSON.parse(getStorageItem("ANILIST_TRACKING") || "[]") as Anilist.TrackStore;
            return tracking.filter((e) => window.fs.existsSync(e.localURL));
        } catch (e) {
            log.error("loadTrackingFromStorage: invalid JSON or read error; clearing tracking list", e);
            return [];
        }
    }
    static setCurrentMangaListId(id: null | number) {
        AniList.#currentMangaListId = id;
    }
    /**
     * Validates a bearer token and loads the viewer's adult-content preference.
     * @returns true on 2xx, false on HTTP error, undefined on network failure
     */
    static async checkToken(token: string) {
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
            const json = await postAnilistGraphql(token, { query });
            if (json && typeof json === "object" && "data" in json) {
                const data = (json as { data?: AnilistGraphqlData }).data;
                AniList.displayAdultContent = Boolean(data?.Viewer?.options?.displayAdultContent);
            }
            return true;
        } catch (reason) {
            if (reason instanceof HttpStatusError) {
                return false;
            }
            dialogUtils.customError({ message: i18n.t("errors.requestFailed", { ns: "anilist" }) });
            log.error("checkToken: request failed", reason);
        }
    }
    /**
     * Runs a GraphQL operation against AniList and returns the envelope `data` field on 2xx.
     * HTTP errors are logged; an invalid-token payload shows a dialog.
     */
    static async request(query: string, variables = {}): Promise<AnilistGraphqlData | undefined> {
        if (!AniList.#token) {
            log.error("request: skipped (no access token; user not logged in)");
            return;
        }
        try {
            const json = await postAnilistGraphql(AniList.#token, { query, variables });
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
    }
    static async getUserName() {
        const query = `#graphql
        query{
            Viewer{
                    name
            }
        }
        `;
        const data = await AniList.request(query);
        if (data?.Viewer?.name) return data.Viewer.name;
        return i18n.t("errors.username", { ns: "anilist" });
    }
    static getVariables(variables: object) {
        return AniList.displayAdultContent ? { ...variables } : { ...variables, displayAdultContent: false };
    }
    /**
     * Search manga and novels on Anilist.
     * @param name search term in `English` or `Romaji`
     * @returns media items (manga and novels), excludes unreleased
     */
    static async searchMedia(name: string): Promise<Anilist.SearchMediaItem[]> {
        if (!name) return [];
        const query = `#graphql
        query($search: String,$displayAdultContent: Boolean){
            Page(page: 1, perPage: 20){
                media(search: $search, type: MANGA, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult:$displayAdultContent ){
                    id
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
                    }
                    status(version: 2)
                }
            }
        }
        `;
        const variables = AniList.getVariables({
            search: name,
        });
        const data = await AniList.request(query, variables);
        if (data) return (data.Page?.media ?? []) as Anilist.SearchMediaItem[];
        return [];
    }
    static async getMangaData(mediaId: number) {
        const variables = AniList.getVariables({ mediaId });
        const data = await AniList.request(AniList.#mutation, variables);
        if (data?.SaveMediaListEntry) {
            return data.SaveMediaListEntry;
        }
    }
    static async setCurrentMangaData(newData: Omit<Anilist.MangaData, "id" | "mediaId" | "media">) {
        if (!AniList.#currentMangaListId) {
            log.error("setCurrentMangaData: currentMangaListId missing; cannot save list entry");
            return;
        }
        const variables = AniList.getVariables({ id: AniList.#currentMangaListId, ...newData });
        const data = await AniList.request(AniList.#mutation, variables);
        if (data?.SaveMediaListEntry) {
            return data.SaveMediaListEntry;
        }
    }
    static async setCurrentMangaProgress(progress: Anilist.MangaData["progress"]) {
        if (!AniList.#currentMangaListId) {
            log.error("setCurrentMangaProgress: currentMangaListId missing; cannot sync progress");
            return;
        }
        const variables = AniList.getVariables({ id: AniList.#currentMangaListId, progress });
        const data = await AniList.request(AniList.#mutation, variables);
        if (data?.SaveMediaListEntry) {
            return data.SaveMediaListEntry;
        }
    }
}

/**
 * Human-readable label for an Anilist media format value.
 *
 * @param format Anilist GraphQL media format enum
 */
export const anilistFormatLabel = (format: Anilist.MediaFormat): string =>
    i18n.t(`format.${format}`, { ns: "anilist", defaultValue: format });

/**
 * Human-readable label for an Anilist media status value.
 *
 * @param status Anilist GraphQL media status enum
 */
export const anilistStatusLabel = (status: Anilist.MediaStatus): string =>
    i18n.t(`status.${status}`, { ns: "anilist", defaultValue: status });
