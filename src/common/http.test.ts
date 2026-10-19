import { describe, expect, it } from "vitest";
import {
    createHttpClient,
    decodePercentEncodedDataUrl,
    HttpMediaTypeError,
    HttpNetworkError,
    HttpStatusError,
    type HttpTransport,
    type HttpTransportResponse,
    isHttpUrlLineList,
    shouldReplaceTextSnapshot,
    splitTextLines,
} from "./http";

/**
 * Builds a client whose transport returns a fixed response (or throws).
 */
const clientWith = (result: HttpTransportResponse | Error): ReturnType<typeof createHttpClient> => {
    const transport: HttpTransport = async () => {
        if (result instanceof Error) throw result;
        return result;
    };
    return createHttpClient(transport);
};

describe("createHttpClient status handling", () => {
    it("throws HttpStatusError on non-2xx and does not return the error body as data", async () => {
        const html = "<!DOCTYPE html><html>rate limit abc123</html>";
        const client = clientWith({
            status: 403,
            statusText: "Forbidden",
            headers: { "Content-Type": "text/html" },
            data: html,
        });

        await expect(client.getText("https://example.com/announcements")).rejects.toSatisfy(
            (error: unknown) =>
                error instanceof HttpStatusError &&
                error.status === 403 &&
                error.data === html &&
                error.url.includes("example.com"),
        );
        await expect(client.getJson("https://example.com/releases")).rejects.toBeInstanceOf(HttpStatusError);
    });

    it("does not treat a non-2xx JSON object as a successful payload", async () => {
        const payload = { message: "API rate limit exceeded" };
        const client = clientWith({
            status: 403,
            statusText: "Forbidden",
            headers: { "content-type": "application/json" },
            data: payload,
        });
        await expect(client.getJson("https://api.github.com/repos/org/repo/releases")).rejects.toSatisfy(
            (error: unknown) => error instanceof HttpStatusError && error.data === payload,
        );
    });

    it("returns JSON and text only for 2xx non-HTML bodies", async () => {
        const releases = [{ tag_name: "v1.0.0", prerelease: false }];
        const jsonClient = clientWith({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "application/json; charset=utf-8" },
            data: releases,
        });
        await expect(jsonClient.getJson("https://example.com/releases")).resolves.toEqual(releases);

        const textClient = clientWith({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "text/plain; charset=utf-8" },
            data: "https://example.com/a\n",
        });
        await expect(textClient.getText("https://example.com/list")).resolves.toBe("https://example.com/a\n");
    });

    it("rejects 2xx HTML via Content-Type", async () => {
        const client = clientWith({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "text/html; charset=utf-8" },
            data: "<!DOCTYPE html><html></html>",
        });
        await expect(client.getText("https://example.com/list")).rejects.toBeInstanceOf(HttpMediaTypeError);
        await expect(client.getJson("https://example.com/api")).rejects.toBeInstanceOf(HttpMediaTypeError);
    });

    it("rejects 2xx text that looks like an HTML document", async () => {
        const client = clientWith({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "text/plain" },
            data: "  <html>nope</html>",
        });
        await expect(client.getText("https://example.com/list")).rejects.toBeInstanceOf(HttpMediaTypeError);
        await expect(client.getJson("https://example.com/api")).rejects.toBeInstanceOf(HttpMediaTypeError);
    });

    it("wraps transport failures as HttpNetworkError", async () => {
        const client = clientWith(new Error("ECONNRESET"));
        await expect(client.getJson("https://example.com/api")).rejects.toSatisfy(
            (error: unknown) => error instanceof HttpNetworkError && error.url === "https://example.com/api",
        );
    });

    it("returns ArrayBuffer for getBuffer and skips the HTML sniff", async () => {
        const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
        const client = clientWith({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "image/png" },
            data: bytes,
        });
        await expect(client.getBuffer("https://example.com/cover.png")).resolves.toBe(bytes);

        // copy into this realm: Node TextEncoder.buffer fails ArrayBuffer instanceof under jsdom
        const htmlLookingBytes = new Uint8Array(new TextEncoder().encode("<html>not really</html>"));
        const htmlLooking = clientWith({
            status: 200,
            statusText: "OK",
            headers: { "content-type": "application/octet-stream" },
            data: htmlLookingBytes.buffer,
        });
        await expect(htmlLooking.getBuffer("https://example.com/bin")).resolves.toBeInstanceOf(ArrayBuffer);
    });
});

describe("createHttpClient request headers", () => {
    it("omits User-Agent when the runtime forbids that header (renderer / jsdom)", async () => {
        let captured: Record<string, string> | undefined;
        const transport: HttpTransport = async (req) => {
            captured = req.headers;
            return {
                status: 200,
                statusText: "OK",
                headers: { "content-type": "application/json" },
                data: {},
            };
        };
        const client = createHttpClient(transport);
        await client.getJson("https://example.com/api");
        expect(captured?.["User-Agent"]).toBeUndefined();
        expect(Object.keys(captured ?? {}).some((key) => key.toLowerCase() === "user-agent")).toBe(false);

        await client.getJson("https://example.com/api", { headers: { "User-Agent": "Nope" } });
        expect(Object.keys(captured ?? {}).some((key) => key.toLowerCase() === "user-agent")).toBe(false);
    });
});

describe("createHttpClient postJson", () => {
    it("sends JSON on POST and returns the decoded body", async () => {
        let capturedJson: unknown;
        const transport: HttpTransport = async (req) => {
            capturedJson = req.json;
            expect(req.method).toBe("POST");
            expect(req.parseAs).toBe("json");
            return {
                status: 200,
                statusText: "OK",
                headers: { "content-type": "application/json" },
                data: { data: { ok: true } },
            };
        };
        const client = createHttpClient(transport);
        const body = await client.postJson("https://example.com/graphql", { query: "{ viewer }" });
        expect(capturedJson).toEqual({ query: "{ viewer }" });
        expect(body).toEqual({ data: { ok: true } });
    });
});

describe("splitTextLines", () => {
    it("splits CRLF, trims, drops empties, and strips a leading BOM", () => {
        expect(splitTextLines("\uFEFFhttps://a.example/\r\n\n  https://b.example/  \r\n")).toEqual([
            "https://a.example/",
            "https://b.example/",
        ]);
    });

    it("does not treat the same URL as new after CRLF vs LF normalize", () => {
        const remote = splitTextLines("https://example.com/a\n");
        const stored = splitTextLines("https://example.com/a\r\n");
        expect(remote.filter((line) => !stored.includes(line))).toEqual([]);
    });
});

describe("shouldReplaceTextSnapshot", () => {
    it("does not let an empty body wipe a non-empty snapshot", () => {
        expect(shouldReplaceTextSnapshot([], ["https://example.com/a"])).toBe(false);
    });

    it("replaces when remote has lines, or when both sides are empty", () => {
        expect(shouldReplaceTextSnapshot(["https://example.com/a"], [])).toBe(true);
        expect(shouldReplaceTextSnapshot([], [])).toBe(true);
    });
});

describe("isHttpUrlLineList", () => {
    it("accepts http(s) URLs and rejects mixed or non-URL lines", () => {
        expect(isHttpUrlLineList(["https://example.com/a", "http://example.com/b"])).toBe(true);
        expect(isHttpUrlLineList(["404: Not Found"])).toBe(false);
        expect(isHttpUrlLineList(["ftp://example.com/a"])).toBe(false);
        expect(isHttpUrlLineList([])).toBe(true);
    });
});

describe("decodePercentEncodedDataUrl", () => {
    it("decodes a percent-encoded SVG data URL and rejects base64 or non-data", () => {
        const uri = `data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'></svg>")}`;
        expect(new TextDecoder().decode(decodePercentEncodedDataUrl(uri) ?? new Uint8Array())).toContain("<svg");
        expect(decodePercentEncodedDataUrl("data:image/png;base64,aaaa")).toBeNull();
        expect(decodePercentEncodedDataUrl("https://example.test/a.jpg")).toBeNull();
    });
});
