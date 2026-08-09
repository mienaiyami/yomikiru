import i18n from "@renderer/i18n";

import { dialogUtils } from "./dialog";
import { getStorageItem, setStorageItem } from "./localStorage";
import { createRendererLogger } from "./logger";

const log = createRendererLogger("AniList");

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
        const body = JSON.stringify({
            query,
        });
        try {
            const raw = await fetch("https://graphql.anilist.co", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body,
            });
            if (raw.ok) {
                const json = await raw.json();
                AniList.displayAdultContent = json.data.Viewer.options.displayAdultContent;
            }
            return raw.ok;
        } catch (reason) {
            dialogUtils.customError({ message: i18n.t("errors.requestFailed", { ns: "anilist" }) });
            log.error("checkToken: request failed", reason);
        }
    }
    static async fetch(query: string, variables = {}) {
        if (!AniList.#token) {
            log.error("fetch: skipped (no access token; user not logged in)");
            return;
        }
        try {
            const body = JSON.stringify({
                query,
                variables,
            });

            const raw = await fetch("https://graphql.anilist.co", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${AniList.#token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body,
            });
            if (raw.ok) {
                const json = await raw.json();
                return json.data;
            } else {
                log.error(`fetch: HTTP ${raw.status} ${raw.statusText} from graphql.anilist.co`);
                const json = await raw.json();
                if (json) {
                    log.error("fetch: error payload from API", json);
                    if (json.errors.message === "Invalid token")
                        dialogUtils.customError({
                            message: i18n.t("errors.invalidToken", { ns: "anilist" }),
                            detail: i18n.t("errors.invalidTokenDetail", { ns: "anilist" }),
                        });
                }
            }
        } catch (reason) {
            log.error("fetch: network or parse error", reason);
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
        const data = await AniList.fetch(query);
        if (data) return data.Viewer.name;
        else return i18n.t("errors.username", { ns: "anilist" });
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
        const data = await AniList.fetch(query, variables);
        if (data) return (data.Page.media ?? []) as Anilist.SearchMediaItem[];
        return [];
    }
    static async getMangaData(mediaId: number) {
        const variables = AniList.getVariables({ mediaId });
        const data = await AniList.fetch(AniList.#mutation, variables);
        if (data) {
            return data.SaveMediaListEntry as Anilist.MangaData;
        }
    }
    static async setCurrentMangaData(newData: Omit<Anilist.MangaData, "id" | "mediaId" | "media">) {
        if (!AniList.#currentMangaListId) {
            log.error("setCurrentMangaData: currentMangaListId missing; cannot save list entry");
            return;
        }
        const variables = AniList.getVariables({ id: AniList.#currentMangaListId, ...newData });
        const data = await AniList.fetch(AniList.#mutation, variables);
        if (data) {
            return data.SaveMediaListEntry as Anilist.MangaData;
        }
    }
    static async setCurrentMangaProgress(progress: Anilist.MangaData["progress"]) {
        if (!AniList.#currentMangaListId) {
            log.error("setCurrentMangaProgress: currentMangaListId missing; cannot sync progress");
            return;
        }
        const variables = AniList.getVariables({ id: AniList.#currentMangaListId, progress });
        const data = await AniList.fetch(AniList.#mutation, variables);
        if (data) {
            return data.SaveMediaListEntry as Anilist.MangaData;
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
