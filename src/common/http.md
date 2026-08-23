# Shared HTTP client

App code in Electron main and the renderer talks to the network through [`http.ts`](./http.ts) (`import { http } from "@common/http"`). Do not use `fetch`, `window.fetch`, or `electron-fetch`.

## Why a client (not fetch)

`fetch` / `electron-fetch` resolve on 4xx/5xx and leave the caller to check `ok`. Missing that check treats GitHub/CDN error HTML or rate-limit JSON as a successful payload. This client throws `HttpStatusError` on non-2xx **before** returning `data`.

Axios is the transport (already pinned in the repo). The public API does not expose axios types; tests inject a fake `HttpTransport`.

## Where it runs

| Process | Bundle | Transport |
| --- | --- | --- |
| Main (`src/electron/**`) | electron-main webpack | axios Node `http` adapter |
| Renderer (`src/renderer/**`) | `target: "web"` | axios XHR adapter |

Same module, same errors. GitHub Releases stay in main (no CORS). AniList GraphQL runs in the renderer.

## API

```ts
import { http, HttpStatusError, splitTextLines } from "@common/http";

const releases = await http.getJson("https://api.github.com/repos/org/app/releases");
const text = await http.getText("https://example.com/notes.txt");
const graphql = await http.postJson("https://graphql.example.com", { query }, { headers: { Authorization: `Bearer ${token}` } });
```

- `http.request` when you need status/headers as well as `data`.
- Override `timeoutMs` / `headers` per call. Defaults: `HTTP_DEFAULT_TIMEOUT_MS`, User-Agent `HTTP_USER_AGENT` (ignored in the browser).
- `createHttpClient(transport)` for tests or a one-off backend.

## Errors

| Class | When |
| --- | --- |
| `HttpStatusError` | status outside 2xx; `data` is the error body (do not use as success) |
| `HttpMediaTypeError` | 2xx but `Content-Type` is HTML, or a text body looks like an HTML document |
| `HttpNetworkError` | timeout, DNS, reset; no status |
| `HttpError` | base; `isHttpError(err)` |

Catch `HttpStatusError` when a 4xx body still needs inspection (e.g. API error payload). Do not persist or display that body as the resource you asked for.

## Text bodies

`splitTextLines` normalizes LF/CRLF/BOM. `shouldReplaceTextSnapshot` refuses to replace a non-empty stored line list with an empty download (blank 2xx must not wipe local state).

## Adding a caller

1. Import `http` from `@common/http`.
2. Use `getJson` / `getText` / `postJson`.
3. Catch `HttpError` (or a subclass) at the feature boundary; log and show UI there, not inside `http.ts`.

Retries stay in `@electron/util/retry` when a caller needs them; the client does not retry.

Binary downloads stay on `electron-dl` (progress, cancel, disk). This module is JSON/text only.
