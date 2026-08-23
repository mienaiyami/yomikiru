import type { PackOverlayMap } from "./types";

/** Minimal i18next surface needed to apply / clear pack overlays. */
export type I18nBundleHost = {
    hasResourceBundle: (lng: string, ns: string) => boolean;
    removeResourceBundle: (lng: string, ns: string) => void;
    addResourceBundle: (
        lng: string,
        ns: string,
        resources: Record<string, unknown>,
        deep: boolean,
        overwrite: boolean,
    ) => void;
};

/**
 * Removes previously applied pack overlays for `locale`.
 *
 * Always re-adds each touched namespace afterward: i18next's `removeResourceBundle`
 * also drops the namespace from the instance-wide `ns` list. Builtin locales are
 * reseeded from a deep clone of `bundledByLocale`; pack-only locales get `{}` so
 * the namespace stays registered while `fallbackLng` supplies strings.
 */
export const clearPackOverlays = (
    host: I18nBundleHost,
    locale: string,
    activeNamespaces: readonly string[],
    bundledByLocale: Record<string, Record<string, Record<string, unknown>>>,
): void => {
    const base = bundledByLocale[locale];
    for (const ns of activeNamespaces) {
        if (host.hasResourceBundle(locale, ns)) {
            host.removeResourceBundle(locale, ns);
        }
        const nsBase = base?.[ns];
        /* JSON clone: same reason as cloneBundledI18nResources (no structuredClone in main). */
        const seed = nsBase ? (JSON.parse(JSON.stringify(nsBase)) as Record<string, unknown>) : {};
        host.addResourceBundle(locale, ns, seed, true, true);
    }
};

/**
 * Deep-merges pack namespace objects onto `locale`. Returns the namespace list that was applied.
 */
export const addPackOverlays = (
    host: I18nBundleHost,
    locale: string,
    overlay: PackOverlayMap | null,
): string[] => {
    if (!overlay) return [];
    const active: string[] = [];
    for (const [ns, resources] of Object.entries(overlay)) {
        host.addResourceBundle(locale, ns, resources, true, true);
        active.push(ns);
    }
    return active;
};
