import { format, formatDistance, formatRelative, isValid } from "date-fns";

export type DateFormatOptions = {
    /** Format to use for the date */
    format?: string;
    /** Fallback string to display if date is invalid */
    fallback?: string;
};

const DEFAULT_FORMAT = "dd/MM/yyyy";
const DEFAULT_FALLBACK = "Invalid date";

/**
 * @returns Formatted date string
 */
const formatDate = (date: Date | string | number | null | undefined, options?: DateFormatOptions): string => {
    if (!date) return options?.fallback || DEFAULT_FALLBACK;

    const dateFormat = options?.format || DEFAULT_FORMAT;
    const fallback = options?.fallback || DEFAULT_FALLBACK;

    try {
        const dateObj = new Date(date);

        if (!isValid(dateObj)) {
            return fallback;
        }

        return format(dateObj, dateFormat);
    } catch (error) {
        console.error("Error formatting date:", error);
        return fallback;
    }
};

/**
 * Formats a date relative to the current time (e.g., "5 minutes ago")
 * @returns Relative time string
 */
const formatRelativeTime = (
    date: Date | string | number | null | undefined,
    options?: { fallback?: string },
): string => {
    if (!date) return options?.fallback || DEFAULT_FALLBACK;

    try {
        const dateObj = new Date(date);

        if (!isValid(dateObj)) {
            return options?.fallback || DEFAULT_FALLBACK;
        }

        return formatDistance(dateObj, new Date(), { addSuffix: true });
    } catch (error) {
        console.error("Error formatting relative date:", error);
        return options?.fallback || DEFAULT_FALLBACK;
    }
};

/**
 * Formats a date relative to another date (e.g., "yesterday at 2:30 PM")
 * @param date - Date to format
 * @param baseDate - Date to compare to
 * @param options - Formatting options
 * @returns Formatted relative date
 */
const formatDateRelativeTo = (
    date: Date | string | number,
    baseDate: Date | string | number = new Date(),
    options?: { fallback?: string },
): string => {
    try {
        const dateObj = new Date(date);
        const baseDateObj = new Date(baseDate);

        if (!isValid(dateObj) || !isValid(baseDateObj)) {
            return options?.fallback || DEFAULT_FALLBACK;
        }

        return formatRelative(dateObj, baseDateObj);
    } catch (error) {
        console.error("Error formatting relative date:", error);
        return options?.fallback || DEFAULT_FALLBACK;
    }
};

const datePresets = {
    short: "dd/MM/yyyy",
    medium: "dd MMM yyyy",
    long: "dd MMMM yyyy",
    full: "EEEE, dd MMMM yyyy",
    time: "hh:mm a",
    dateTime: "dd/MM/yyyy, hh:mm a",
    iso: "yyyy-MM-dd",
    isoDateTime: "yyyy-MM-dd'T'HH:mm:ss",
    monthYear: "MMMM yyyy",
} as const;

const dateUtils = {
    format: formatDate,
    relative: formatRelativeTime,
    relativeTo: formatDateRelativeTo,
    presets: datePresets,
};

export default dateUtils;
