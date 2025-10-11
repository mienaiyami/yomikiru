import { log } from ".";

export type RetryOptions = {
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Delay between retries in milliseconds */
    retryDelay?: number;
    /** Exponential backoff multiplier (e.g., 2 = double delay each retry) */
    backoffMultiplier?: number;
    /** Maximum delay between retries in milliseconds */
    maxDelay?: number;
    /** Function to determine if error should trigger retry */
    shouldRetry?: (error: Error, attempt: number) => boolean;
    /** Callback called on each retry attempt */
    onRetry?: (error: Error, attempt: number) => void;
};

/**
 * Retry an async operation with configurable options
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *     async () => {
 *         const response = await fetch('https://api.example.com/data');
 *         return response.json();
 *     },
 *     {
 *         maxRetries: 3,
 *         retryDelay: 1000,
 *         backoffMultiplier: 2,
 *         shouldRetry: (error) => error.message.includes('network'),
 *     }
 * );
 * ```
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
        maxRetries = 3,
        retryDelay = 1000,
        backoffMultiplier = 1,
        maxDelay = 30000,
        shouldRetry = () => true,
        onRetry,
    } = options;

    let lastError: Error | null = null;
    let currentDelay = retryDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // don't retry on last attempt
            if (attempt === maxRetries) {
                break;
            }

            // check if we should retry this error
            if (!shouldRetry(lastError, attempt + 1)) {
                throw lastError;
            }

            // call retry callback if provided
            if (onRetry) {
                onRetry(lastError, attempt + 1);
            } else {
                log.warn(`Operation failed, retrying (${attempt + 1}/${maxRetries})...`, {
                    error: lastError.message,
                });
            }

            // wait before retry with exponential backoff
            await new Promise((resolve) => setTimeout(resolve, currentDelay));

            // calculate next delay with backoff
            currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
        }
    }

    throw lastError;
}

/**
 * Create a retryable version of an async function
 *
 * @example
 * ```ts
 * const fetchWithRetry = makeRetryable(
 *     async (url: string) => {
 *         const response = await fetch(url);
 *         return response.json();
 *     },
 *     { maxRetries: 3, retryDelay: 1000 }
 * );
 *
 * const data = await fetchWithRetry('https://api.example.com/data');
 * ```
 */
export function makeRetryable<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    options: RetryOptions = {},
): (...args: T) => Promise<R> {
    return (...args: T) => withRetry(() => fn(...args), options);
}

/**
 * Common retry configurations for different scenarios
 */
export const RetryPresets = {
    /** Fast retry for transient errors (3 retries, 500ms delay) */
    fast: {
        maxRetries: 3,
        retryDelay: 500,
        backoffMultiplier: 1.5,
    } as RetryOptions,

    /** Standard retry for most operations (3 retries, 1s delay, exponential backoff) */
    standard: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 10000,
    } as RetryOptions,

    /** Aggressive retry for critical operations (5 retries, 2s delay, exponential backoff) */
    aggressive: {
        maxRetries: 5,
        retryDelay: 2000,
        backoffMultiplier: 2,
        maxDelay: 30000,
    } as RetryOptions,

    /** Network retry optimized for network failures */
    network: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 10000,
        shouldRetry: (error) => {
            const networkErrors = ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"];
            return networkErrors.some((code) => error.message.includes(code));
        },
    } as RetryOptions,

    /** Database retry optimized for database operations */
    database: {
        maxRetries: 3,
        retryDelay: 500,
        backoffMultiplier: 2,
        shouldRetry: (error) => {
            const retryableErrors = ["SQLITE_BUSY", "SQLITE_LOCKED", "database is locked"];
            return retryableErrors.some((code) => error.message.includes(code));
        },
    } as RetryOptions,
};
