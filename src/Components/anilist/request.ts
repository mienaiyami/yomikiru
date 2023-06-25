export default class AniList {
    #token = "";
    displayAdultContent = false;

    constructor(token: string) {
        this.#token = token;
        if (token)
            this.checkToken(token).then((e) => {
                if (!e && e !== undefined)
                    window.dialog.customError({
                        message:
                            "Unable to login to AniList. If persists, try loging in again using different token.",
                    });
            });
    }
    setToken(token: string) {
        this.#token = token;
    }
    async checkToken(token: string) {
        const query = `
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
            window.dialog.customError({ message: "Unable to make request to AniList server." });
        }
    }
    async fetch(query: string, variables = {}) {
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
                        window.dialog.customError({
                            message: "AniList: Invalid token",
                            detail: "Try logging out and in again.",
                        });
                }
            }
        } catch (reason) {
            window.logger.error("AniList::fetch:\n" + reason);
        }
    }
    async getUserName() {
        const query = `
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
    getVariables(variables: object) {
        return this.displayAdultContent ? { ...variables } : { ...variables, displayAdultContent: false };
    }
    /**
     *
     * @param name search term in `English` or `Romaji`
     * does not include unreleased manga
     */
    async searchManga(name: string) {
        if (!name) return [];
        const query = `
        query($search: String,$displayAdultContent: Boolean){
            Page(page: 1, perPage: 20){
                media(search: $search, type: MANGA, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, isAdult:$displayAdultContent ){
                    id
                    title{
                      english
                      romaji
                    }
                    startDate{
                        year
                        month
                        day
                    }
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
            return data.Page.media as {
                id: number;
                title: {
                    english: string;
                    romaji: string;
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
    async getMangaData(mediaId: number) {
        const query = `
        mutation($mediaId: Int){
          SaveMediaListEntry(mediaId:$mediaId){
            status
            progress
            score
            repeat
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
        const variables = this.getVariables({ mediaId });
        const data = await this.fetch(query, variables);
        console.log(data);
        if (data) {
            return data.SaveMediaListEntry as AniListMangaData;
        }
    }
}