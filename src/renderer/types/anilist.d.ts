declare namespace Anilist {
    type MediaFormat =
        | "MANGA"
        | "NOVEL"
        | "ONE_SHOT"
        | "MANHWA"
        | "MANHUA"
        | "DOUJINSHI"
        | "OEL"
        | "LIGHT_NOVEL";

    type MediaStatus = "FINISHED" | "RELEASING" | "CANCELLED" | "HIATUS" | "NOT_YET_RELEASED";

    type SearchMediaItem = {
        id: number;
        idMal: number | null;
        title: {
            english: string | null;
            romaji: string | null;
            native: string | null;
        };
        startDate: {
            year: number | null;
            month: number | null;
            day: number | null;
        };
        format: MediaFormat;
        coverImage: CoverImage;
        bannerImage?: string | null;
        siteUrl?: string | null;
        description?: string | null;
        genres?: string[];
        chapters?: number | null;
        volumes?: number | null;
        averageScore?: number | null;
        status: MediaStatus;
    };

    /** Legacy localStorage tracking row. Import-only; live tracking is `ItemTracker` in the DB. */
    type TrackItem = {
        localURL: string;
        anilistMediaId: number;
    };
    type TrackStore = TrackItem[];

    /** `MediaCoverImage` fields used for display and {@link TrackerMediaSnapshot.coverImage}. */
    type CoverImage = {
        extraLarge?: string | null;
        large?: string | null;
        medium?: string | null;
        color?: string | null;
    };

    /** AniList MediaListEntry payload (manga, novels, and other AniList `type: MANGA` formats). */
    type ListEntry = {
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
            coverImage: CoverImage;
            bannerImage: string;
            siteUrl: string;
            description?: string | null;
            genres?: string[];
            chapters?: number | null;
            volumes?: number | null;
            averageScore?: number | null;
            idMal?: number | null;
            status?: MediaStatus | null;
            format?: MediaFormat | null;
            staff?: {
                edges?: {
                    role?: string | null;
                    node?: {
                        name?: { full?: string | null } | null;
                    } | null;
                }[] | null;
            } | null;
        };
    };
}
