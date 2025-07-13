export type ValidationResult = {
    isValid: boolean;
    images?: string[];
    error?: Error | string;
};

export type ValidationProgressCallback = (progress: { percent?: number; message?: string } | null) => void;

export type DirectoryValidatorOptions = {
    /**
     * default: false
     */
    sendImages?: boolean;
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
