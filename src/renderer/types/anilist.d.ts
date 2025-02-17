declare namespace Anilist {
    type TrackItem = {
        localURL: string;
        anilistMediaId: number;
    };
    type TrackStore = TrackItem[];
    type MangaData = {
        id: number;
        mediaId: number;
        status: "CURRENT" | "PLANNING" | "COMPLETED" | "DROPPED" | "PAUSED" | "REPEATING";
        progress: number;
        progressVolumes: number;
        score: number;
        repeat: number;
        private: boolean;
        startedAt: {
            year: number | null;
            month: number | null;
            day: number | null;
        };
        completedAt: {
            year: number | null;
            month: number | null;
            day: number | null;
        };
        media: {
            title: {
                english: string;
                romaji: string;
                native: string;
            };
            coverImage: {
                medium: string;
            };
            bannerImage: string;
            siteUrl: string;
        };
    };
}
