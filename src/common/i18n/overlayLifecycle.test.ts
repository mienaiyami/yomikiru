import { describe, expect, it } from "vitest";
import { addPackOverlays, clearPackOverlays, type I18nBundleHost } from "./overlayLifecycle";

/**
 * Host that mirrors i18next: deep-merge mutates the existing bundle object in place.
 */
const createHost = (
    seed?: Record<string, Record<string, Record<string, unknown>>>,
    aliasSeed = false,
): I18nBundleHost & {
    store: Record<string, Record<string, Record<string, unknown>>>;
} => {
    const store: Record<string, Record<string, Record<string, unknown>>> = aliasSeed
        ? (seed ?? {})
        : structuredClone(seed ?? {});
    return {
        store,
        hasResourceBundle: (lng, ns) => Boolean(store[lng]?.[ns]),
        removeResourceBundle: (lng, ns) => {
            delete store[lng]?.[ns];
        },
        addResourceBundle: (lng, ns, resources, deep, overwrite) => {
            store[lng] ??= {};
            let pack = store[lng][ns];
            if (!pack) {
                pack = {};
                store[lng][ns] = pack;
            }
            const incoming = structuredClone(resources);
            if (deep) {
                for (const key of Object.keys(incoming)) {
                    if (overwrite || pack[key] === undefined) {
                        pack[key] = incoming[key];
                    }
                }
                return;
            }
            if (overwrite) store[lng][ns] = incoming;
        },
    };
};

describe("overlayLifecycle", () => {
    it("adds pack overlays and returns active namespaces", () => {
        const host = createHost();
        const active = addPackOverlays(host, "ja", { common: { hi: "Konnichiwa" } });
        expect(active).toEqual(["common"]);
        expect(host.store.ja.common.hi).toBe("Konnichiwa");
    });

    it("restores bundled English after clearing an en overlay", () => {
        const bundled = { en: { common: { hi: "Hello", bye: "Bye" } } };
        const host = createHost({ en: { common: { ...bundled.en.common } } });
        const active = addPackOverlays(host, "en", { common: { hi: "HiPack" } });
        expect(host.store.en.common).toEqual({ hi: "HiPack", bye: "Bye" });
        clearPackOverlays(host, "en", active, bundled);
        expect(host.store.en.common).toEqual({ hi: "Hello", bye: "Bye" });
    });

    it("restores a non-en builtin when the store was seeded from a clone", () => {
        const seedCommon = { hi: "안녕", bye: "잘가" };
        const bundled = { ko: { common: seedCommon } };
        const host = createHost({ ko: { common: structuredClone(seedCommon) } });
        const active = addPackOverlays(host, "ko", { common: { hi: "팩" } });
        expect(seedCommon.hi).toBe("안녕");
        expect(host.store.ko.common).toEqual({ hi: "팩", bye: "잘가" });
        clearPackOverlays(host, "ko", active, bundled);
        expect(host.store.ko.common).toEqual({ hi: "안녕", bye: "잘가" });
        expect(seedCommon.hi).toBe("안녕");
    });

    it("shows why init must clone: aliased seeds are mutated by pack merge", () => {
        const seedCommon = { hi: "안녕", bye: "잘가" };
        const host = createHost({ ko: { common: seedCommon } }, true);
        addPackOverlays(host, "ko", { common: { hi: "팩A" } });
        expect(seedCommon.hi).toBe("팩A");
    });

    it("replaces leftover keys when switching packs on the same locale via clear+add", () => {
        const bundled = { ko: { common: { hi: "안녕" } } };
        const host = createHost({ ko: { common: { hi: "안녕" } } });
        const activeA = addPackOverlays(host, "ko", { common: { hi: "A", onlyA: "keep?" } });
        clearPackOverlays(host, "ko", activeA, bundled);
        addPackOverlays(host, "ko", { common: { hi: "B" } });
        expect(host.store.ko.common).toEqual({ hi: "B" });
        expect(host.store.ko.common).not.toHaveProperty("onlyA");
    });

    it("re-registers pack-only namespaces as empty after clear (keeps ns alive)", () => {
        const host = createHost({ en: { common: { hi: "Hello" } }, de: { common: { hi: "Hallo" } } });
        clearPackOverlays(host, "de", ["common"], { en: { common: { hi: "Hello" } } });
        expect(host.store.de.common).toEqual({});
        expect(host.store.en.common.hi).toBe("Hello");
    });
});
