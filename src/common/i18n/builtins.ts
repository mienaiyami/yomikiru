import { bundledEnResources } from "./bundledEn";
import type { LanguageSource, PackOverlayMap } from "./types";

/**
 * One shipped builtin locale. Add a row here (+ `locales/<locale>/*.json`) to ship another language.
 * Partial `resources` are fine; missing keys fall back to English via `fallbackLng: "en"`.
 */
export type BuiltinLocaleDefinition = {
    locale: string;
    name: string;
    resources: PackOverlayMap;
};

/**
 * Registry of webpack-bundled locales. Order = language picker order.
 */
export const BUILTIN_LOCALES: readonly BuiltinLocaleDefinition[] = [
    { locale: "en", name: "English", resources: bundledEnResources },
];

/** Default language source id (`builtin:en`). */
export const BUILTIN_EN_SOURCE_ID = "builtin:en";

/**
 * Builds `builtin:<locale>` source ids.
 */
export const builtinSourceId = (locale: string): string => `builtin:${locale}`;

/**
 * Parses a known builtin source id to its locale, or null.
 */
export const parseBuiltinSourceId = (sourceId: string): string | null => {
    if (!sourceId.startsWith("builtin:")) return null;
    const locale = sourceId.slice("builtin:".length);
    return BUILTIN_LOCALES.some((entry) => entry.locale === locale) ? locale : null;
};

/** True when `sourceId` is a registered builtin. */
export const isBuiltinSourceId = (sourceId: string): boolean => parseBuiltinSourceId(sourceId) !== null;

/**
 * Looks up a builtin locale definition.
 */
export const getBuiltinLocale = (locale: string): BuiltinLocaleDefinition | undefined =>
    BUILTIN_LOCALES.find((entry) => entry.locale === locale);

/** Builtin picker entries derived from {@link BUILTIN_LOCALES}. */
export const BUILTIN_SOURCES: readonly LanguageSource[] = BUILTIN_LOCALES.map((entry) => ({
    id: builtinSourceId(entry.locale),
    name: entry.name,
    locale: entry.locale,
    kind: "builtin" as const,
}));

/** English builtin source (heal / default target). */
export const BUILTIN_EN_SOURCE: LanguageSource =
    BUILTIN_SOURCES.find((s) => s.id === BUILTIN_EN_SOURCE_ID) ?? BUILTIN_SOURCES[0];

/**
 * i18next `resources` map for every builtin locale (module seeds — do not pass to i18next init).
 * Use {@link cloneBundledI18nResources} so pack overlays cannot mutate these objects.
 */
export const bundledI18nResources: Record<string, PackOverlayMap> = Object.fromEntries(
    BUILTIN_LOCALES.map((entry) => [entry.locale, entry.resources]),
);

/**
 * Deep-clones {@link bundledI18nResources} for i18next `init({ resources })`.
 * i18next's ResourceStore keeps the map by reference and `addResourceBundle` deep-merges
 * into those objects; without a clone, installing a pack permanently corrupts builtin seeds.
 */
export const cloneBundledI18nResources = (): Record<string, PackOverlayMap> =>
    structuredClone(bundledI18nResources);
