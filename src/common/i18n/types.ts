/**
 * Discriminator for language picker entries.
 */
export type LanguageSourceKind = "builtin" | "pack";

/**
 * A selectable UI language: either a shipped builtin catalog or one installed pack (one locale).
 */
export type LanguageSource = {
    id: string;
    name: string;
    locale: string;
    kind: LanguageSourceKind;
    /** Present when {@link LanguageSource.kind} is `"pack"`. */
    packId?: string;
    version?: string;
};

/**
 * Pack overlay map: namespace -> resource object, applied with `addResourceBundle(..., true, true)`.
 */
export type PackOverlayMap = Record<string, Record<string, unknown>>;

/**
 * Full i18n snapshot for renderer sync and settings UI.
 */
export type I18nState = {
    sourceId: string;
    locale: string;
    sources: LanguageSource[];
    packOverlay: PackOverlayMap | null;
};

/**
 * Main -> renderer language change payload (full overlay; no second fetch).
 */
export type I18nChangedPayload = {
    sourceId: string;
    locale: string;
    packOverlay: PackOverlayMap | null;
};
