export type ValidationResult = {
    isValid: boolean;
    images?: string[];
    /** When `firstImageOnly` is used, total image files in the scanned folder (same as `images.length` for full `sendImages`). */
    imageCount?: number;
    error?: Error | string;
};

export type ValidationProgressCallback = (progress: { percent?: number; message?: string } | null) => void;

export type DirectoryValidatorOptions = {
    /**
     * default: false
     */
    sendImages?: boolean;
    /**
     * When true, returns only the first sorted image path and `imageCount`, without building the full path array.
     * Use for cover/materialize flows; keep `sendImages` false to avoid allocating huge lists.
     */
    firstImageOnly?: boolean;
    /**
     * How many levels of subdirectories to check for images
     * 0 means no subdirectories will be checked
     * @default 1
     */
    maxSubdirectoryDepth?: number;
    /**
     * Whether to use the cache for validation results
     * @default true
     */
    useCache?: boolean;
    /**
     * Whether to show an error dialog if the directory is invalid
     * default: true
     */
    errorOnInvalid?: boolean;
    /**
     * Whether to show loading indicators during validation
     * @default false
     */
    showLoading?: boolean;
};
