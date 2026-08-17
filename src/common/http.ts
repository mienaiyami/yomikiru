import axios from "axios";

/** Default request timeout for {@link http}. Callers may override per request. */
export const HTTP_DEFAULT_TIMEOUT_MS = 30_000;

/** Identifying User-Agent for Node/main requests (browsers ignore this header). */
export const HTTP_USER_AGENT = "Yomikiru";

export type HttpMethod = "GET" | "POST";

export type HttpParseAs = "json" | "text";

/** Optional fields shared by convenience methods and {@link HttpRequest}. */
export type HttpRequestInit = {
    headers?: Record<string, string>;
    timeoutMs?: number;
};

/**
 * One HTTP call. `json` is serialized as the request body for POST.
 * {@link HttpParseAs} selects how the response body is decoded.
 */
export type HttpRequest = HttpRequestInit & {
    url: string;
    method?: HttpMethod;
    json?: unknown;
    parseAs?: HttpParseAs;
};

/** Successful 2xx result after media-type checks. */
export type HttpResponse = {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    url: string;
    data: unknown;
};

/**
 * Transport input after defaults are applied. Used by {@link createHttpClient} and tests.
 */
export type NormalizedHttpRequest = {
    url: string;
    method: HttpMethod;
    headers: Record<string, string>;
    json?: unknown;
    timeoutMs: number;
    parseAs: HttpParseAs;
};

/** Raw result from a {@link HttpTransport}; the client maps this into success or {@link HttpError}. */
export type HttpTransportResponse = {
    status: number;
    statusText: string;
    headers?: Record<string, string>;
    data: unknown;
    url?: string;
};

/**
 * Performs a single HTTP exchange. Production uses axios; tests pass a fake.
 * Must not use `fetch` / `electron-fetch`.
 */
export type HttpTransport = (request: NormalizedHttpRequest) => Promise<HttpTransportResponse>;

/** Base error for the shared HTTP client. `url` is the request URL. */
export class HttpError extends Error {
    readonly url: string;

    constructor(message: string, url: string) {
        super(message);
        this.name = "HttpError";
        this.url = url;
    }
}

/**
 * Non-2xx HTTP status. `data` is the error body when the transport decoded one;
 * callers must not treat it as a successful payload.
 */
export class HttpStatusError extends HttpError {
    readonly status: number;
    readonly statusText: string;
    readonly data: unknown;

    constructor(url: string, status: number, statusText: string, data: unknown) {
        super(`${url}: HTTP ${status} ${statusText}`, url);
        this.name = "HttpStatusError";
        this.status = status;
        this.statusText = statusText;
        this.data = data;
    }
}

/** 2xx response whose Content-Type or body is HTML instead of the requested JSON/text. */
export class HttpMediaTypeError extends HttpError {
    readonly contentType: string;

    constructor(url: string, contentType: string) {
        super(`${url}: unexpected HTML (${contentType || "unknown type"})`, url);
        this.name = "HttpMediaTypeError";
        this.contentType = contentType;
    }
}

/** DNS, TCP, TLS, timeout, or other failure with no HTTP status. */
export class HttpNetworkError extends HttpError {
    readonly cause: unknown;

    constructor(url: string, cause: unknown) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        super(`${url}: network error (${detail})`, url);
        this.name = "HttpNetworkError";
        this.cause = cause;
    }
}

/**
 * True when `error` was thrown by this client (status, media type, or network).
 */
export const isHttpError = (error: unknown): error is HttpError => error instanceof HttpError;

export type HttpClient = {
    /**
     * Sends the request and returns a 2xx payload.
     *
     * @throws {HttpStatusError} when status is outside 2xx
     * @throws {HttpMediaTypeError} when a 2xx body is HTML
     * @throws {HttpNetworkError} when the transport fails without a status
     */
    request: (input: HttpRequest) => Promise<HttpResponse>;
    /**
     * GET with JSON decoding.
     *
     * @throws {HttpStatusError} when status is outside 2xx
     * @throws {HttpMediaTypeError} when a 2xx body is HTML
     * @throws {HttpNetworkError} when the transport fails without a status
     */
    getJson: (url: string, init?: HttpRequestInit) => Promise<unknown>;
    /**
     * GET with a text body.
     *
     * @throws {HttpStatusError} when status is outside 2xx
     * @throws {HttpMediaTypeError} when a 2xx body is HTML
     * @throws {HttpNetworkError} when the transport fails without a status
     * @throws {HttpError} when the decoded body is not a string
     */
    getText: (url: string, init?: HttpRequestInit) => Promise<string>;
    /**
     * POST JSON and decode a JSON body.
     *
     * @throws {HttpStatusError} when status is outside 2xx
     * @throws {HttpMediaTypeError} when a 2xx body is HTML
     * @throws {HttpNetworkError} when the transport fails without a status
     */
    postJson: (url: string, json: unknown, init?: HttpRequestInit) => Promise<unknown>;
};

const stripBom = (body: string): string => body.replace(/^\uFEFF/, "");

const isHtmlContentType = (contentType: string): boolean => contentType.toLowerCase().includes("text/html");

/** True when a decoded body looks like an HTML document rather than JSON or a text list. */
const looksLikeHtml = (data: unknown): boolean =>
    typeof data === "string" && stripBom(data).trimStart().startsWith("<");

/** Lowercases header names so Content-Type checks do not depend on transport casing. */
const normalizeHeaders = (headers: Record<string, string> | undefined): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!headers) return out;
    for (const [key, value] of Object.entries(headers)) {
        out[key.toLowerCase()] = value;
    }
    return out;
};

/** Default User-Agent / JSON headers, then caller headers (caller wins). */
const mergeRequestHeaders = (init: HttpRequest): Record<string, string> => {
    const headers: Record<string, string> = {
        "User-Agent": HTTP_USER_AGENT,
        ...(init.json !== undefined
            ? { "Content-Type": "application/json", Accept: "application/json" }
            : {}),
        ...init.headers,
    };
    return headers;
};

/** Fills method, timeout, parseAs, and headers before the transport runs. */
const normalizeRequest = (input: HttpRequest): NormalizedHttpRequest => ({
    url: input.url,
    method: input.method ?? "GET",
    headers: mergeRequestHeaders(input),
    json: input.json,
    timeoutMs: input.timeoutMs ?? HTTP_DEFAULT_TIMEOUT_MS,
    parseAs: input.parseAs ?? "json",
});

/**
 * Builds a client around a transport. Non-2xx and HTML success bodies throw
 * before `data` is returned so callers never parse error pages as payloads.
 */
export const createHttpClient = (transport: HttpTransport): HttpClient => {
    const request = async (input: HttpRequest): Promise<HttpResponse> => {
        const normalized = normalizeRequest(input);
        let raw: HttpTransportResponse;
        try {
            raw = await transport(normalized);
        } catch (error) {
            if (error instanceof HttpError) throw error;
            throw new HttpNetworkError(normalized.url, error);
        }

        const headers = normalizeHeaders(raw.headers);
        const url = raw.url ?? normalized.url;
        const contentType = headers["content-type"] ?? "";

        if (raw.status < 200 || raw.status >= 300) {
            throw new HttpStatusError(url, raw.status, raw.statusText, raw.data);
        }

        if (isHtmlContentType(contentType) || looksLikeHtml(raw.data)) {
            throw new HttpMediaTypeError(url, contentType);
        }

        return {
            status: raw.status,
            statusText: raw.statusText,
            headers,
            url,
            data: raw.data,
        };
    };

    return {
        request,
        getJson: async (url, init) => {
            const res = await request({ ...init, url, method: "GET", parseAs: "json" });
            return res.data;
        },
        getText: async (url, init) => {
            const res = await request({ ...init, url, method: "GET", parseAs: "text" });
            if (typeof res.data !== "string") {
                throw new HttpError(`${url}: expected text body`, url);
            }
            return res.data;
        },
        postJson: async (url, json, init) => {
            const res = await request({ ...init, url, method: "POST", json, parseAs: "json" });
            return res.data;
        },
    };
};

/**
 * Axios adapter for {@link http}. `validateStatus` is always true so this module
 * maps status onto {@link HttpStatusError} instead of leaking axios errors.
 * Header values are flattened to strings for {@link HttpTransportResponse}.
 */
const axiosTransport: HttpTransport = async (request) => {
    const response = await axios.request({
        url: request.url,
        method: request.method,
        headers: request.headers,
        data: request.json,
        timeout: request.timeoutMs,
        responseType: request.parseAs === "text" ? "text" : "json",
        validateStatus: () => true,
        maxRedirects: 5,
    });

    const headers: Record<string, string> = {};
    const rawHeaders = response.headers;
    if (rawHeaders && typeof rawHeaders === "object") {
        for (const [key, value] of Object.entries(rawHeaders)) {
            if (typeof value === "string") headers[key] = value;
            else if (Array.isArray(value)) headers[key] = value.join(", ");
        }
    }

    return {
        status: response.status,
        statusText: response.statusText,
        headers,
        data: response.data,
        url: typeof response.config.url === "string" ? response.config.url : request.url,
    };
};

/**
 * Shared HTTP client for Electron main and the renderer. Axios is the transport;
 * do not call `fetch` or `electron-fetch` from app code.
 */
export const http = createHttpClient(axiosTransport);

/**
 * Splits a text response body into trimmed non-empty lines (LF or CRLF, optional BOM).
 */
export const splitTextLines = (body: string): string[] =>
    stripBom(body)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

/**
 * Whether a successful text body should replace a previously stored line snapshot.
 * An empty body must not wipe a non-empty snapshot.
 */
export const shouldReplaceTextSnapshot = (remoteLines: string[], storedLines: string[]): boolean =>
    !(remoteLines.length === 0 && storedLines.length > 0);

/**
 * True when `value` is an absolute http(s) URL.
 */
export const isAbsoluteHttpUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

/**
 * True when every line is an absolute http(s) URL.
 * A 2xx body that is not a URL list must not replace a stored snapshot.
 */
export const isHttpUrlLineList = (lines: string[]): boolean => lines.every(isAbsoluteHttpUrl);
