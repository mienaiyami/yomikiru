export const STORAGE_KEYS = {
    ANILIST_TOKEN: "anilist_token",
    ANILIST_TRACKING: "anilist_tracking",
} as const;

export const setStorageItem = (key: keyof typeof STORAGE_KEYS, value: string) => {
    localStorage.setItem(STORAGE_KEYS[key], value);
};

export const getStorageItem = (key: keyof typeof STORAGE_KEYS) => {
    return localStorage.getItem(STORAGE_KEYS[key]);
};
