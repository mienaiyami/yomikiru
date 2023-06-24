export default class AniList {
    private token = "";
    constructor(token: string) {
        this.token = token;
    }
    setToken(token: string) {
        this.token = token;
    }
    async checkToken(token: string) {
        const query = `
    query{
        Viewer{
                name
        }
    }
    `;
        const body = JSON.stringify({
            query,
        });
        const raw = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
                Authorization: "Bearer " + token,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body,
        });
        return raw.ok;
    }
    async fetch(query: string, variables = {}) {
        if (!this.token) {
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
                    Authorization: "Bearer " + this.token,
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
}
