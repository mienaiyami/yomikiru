import { dialogUtils } from "./dialog";

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
        // for first launch
        if (localStorage.getItem("anilist_token") === null) localStorage.setItem("anilist_token", "");
        if (localStorage.getItem("anilist_tracking") === null) localStorage.setItem("anilist_tracking", "[]");

        const token = localStorage.getItem("anilist_token") || "";
        this.#token = token;
        if (token)
            this.checkToken(token).then((e) => {
                if (!e && e !== undefined)
                    dialogUtils.customError({
                        message:
                            "Unable to login to AniList. If persists, try logging in again using different token.",
                    });
            });
    }
    private constructor() {
        throw new Error("Cannot instantiate static class");
    }
    static setToken(token: string) {
        this.#token = token;
    }
    static setCurrentMangaListId(id: null | number) {
        this.#currentMangaListId = id;
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
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body,
            });
            if (raw.ok) {
                const json = await raw.json();
                this.displayAdultContent = json.data.Viewer.options.displayAdultContent;
            }
            return raw.ok;
        } catch (reason) {
            dialogUtils.customError({ message: "Unable to make request to AniList server." });
        }
    }
    static async fetch(query: string, variables = {}) {
        if (!this.#token) {
            window.logger.error("AniList::fetch: user not logged in.");
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
                    Authorization: "Bearer " + this.#token,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body,
            });
            if (raw.ok) {
                const json = await raw.json();
                return json.data;
            } else {
                window.logger.error("AniList::fetch: response not ok.");
                const json = await raw.json();
                if (json) {
                    window.logger.error(json);
                    if (json.errors.message === "Invalid token")
                        dialogUtils.customError({
                            message: "AniList: Invalid token",
                            detail: "Try logging out and in again.",
                        });
                }
            }
        } catch (reason) {
            window.logger.error("AniList::fetch:\n" + reason);
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
        const data = await this.fetch(query);
        if (data) return data.Viewer.name;
        else return "Error";
    }
    static getVariables(variables: object) {
        return this.displayAdultContent ? { ...variables } : { ...variables, displayAdultContent: false };
    }
    /**
     *
     * @param name search term in `English` or `Romaji`
     * does not include unreleased manga
     */
    static async searchManga(name: string) {
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
        const variables = this.getVariables({
            search: name,
        });
        const data = await this.fetch(query, variables);
        if (data)
            return data.Page.media.filter((e: any) => e.format !== "NOVEL") as {
                id: number;
                title: {
                    english: string;
                    romaji: string;
                    native: string;
                };
                startDate: {
                    year: number;
                    month: number;
                    day: number;
                };
                coverImage: {
                    medium: string;
                };
                status: "FINISHED" | "RELEASING" | "CANCELLED" | "HIATUS";
            }[];
        return [];
    }
    static async getMangaData(mediaId: number) {
        const variables = this.getVariables({ mediaId });
        const data = await this.fetch(this.#mutation, variables);
        if (data) {
            return data.SaveMediaListEntry as Anilist.MangaData;
        }
    }
    static async setCurrentMangaData(newData: Omit<Anilist.MangaData, "id" | "mediaId" | "media">) {
        if (!this.#currentMangaListId) {
            window.logger.error("AniList::setCurrentMangaStatus: currentMangaListId not defined.");
            return;
        }
        const variables = this.getVariables({ id: this.#currentMangaListId, ...newData });
        const data = await this.fetch(this.#mutation, variables);
        if (data) {
            return data.SaveMediaListEntry as Anilist.MangaData;
        }
    }
    static async setCurrentMangaProgress(progress: Anilist.MangaData["progress"]) {
        if (!this.#currentMangaListId) {
            window.logger.error("AniList::setCurrentMangaProgress: currentMangaListId not defined.");
            return;
        }
        const variables = this.getVariables({ id: this.#currentMangaListId, progress });
        const data = await this.fetch(this.#mutation, variables);
        if (data) {
            return data.SaveMediaListEntry as Anilist.MangaData;
        }
    }
}
