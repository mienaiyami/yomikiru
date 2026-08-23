export const STORAGE_KEYS = {
    ANILIST_TOKEN: "anilist_token",
    ANILIST_TRACKING: "anilist_tracking",
    /** Set after the one-shot localStorage -> DB tracker import. The tracking key is never deleted. */
    ANILIST_TRACKING_IMPORTED: "anilist_tracking_imported",
} as const;

export const setStorageItem = (key: keyof typeof STORAGE_KEYS, value: string) => {
    localStorage.setItem(STORAGE_KEYS[key], value);
};

export const getStorageItem = (key: keyof typeof STORAGE_KEYS) => {
    return localStorage.getItem(STORAGE_KEYS[key]);
};
