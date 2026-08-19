import { describe, expect, it } from "vitest";
import { DETAILS_ABOUT_HTML_TAGS, sanitizeHtmlAllowlist } from "./html";

describe("sanitizeHtmlAllowlist", () => {
    it("keeps emphasis and line breaks and strips disallowed tags and attributes", () => {
        const html = sanitizeHtmlAllowlist(
            '<p>Hello <b class="x">bold</b> and <i>italic</i><br><script>alert(1)</script><a href="https://evil.test">link</a></p>',
            DETAILS_ABOUT_HTML_TAGS,
        );
        expect(html).toBe("<p>Hello <b>bold</b> and <i>italic</i><br>link</p>");
    });

    it("escapes raw text so markup is not injected as elements", () => {
        expect(sanitizeHtmlAllowlist("a < b", DETAILS_ABOUT_HTML_TAGS)).toBe("a &lt; b");
    });
});
