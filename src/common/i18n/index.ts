export {
    BUILTIN_EN_SOURCE,
    BUILTIN_EN_SOURCE_ID,
    BUILTIN_LOCALES,
    BUILTIN_SOURCES,
    type BuiltinLocaleDefinition,
    builtinSourceId,
    bundledI18nResources,
    cloneBundledI18nResources,
    getBuiltinLocale,
    isBuiltinSourceId,
    parseBuiltinSourceId,
} from "./builtins";
export { bundledEnResources } from "./bundledEn";
export { DEFAULT_NS, I18N_NAMESPACES, type I18nNamespace, isI18nNamespace } from "./namespaces";
export {
    addPackOverlays,
    clearPackOverlays,
    type I18nBundleHost,
} from "./overlayLifecycle";
export {
    PACK_ALLOWED_NAMESPACES,
    PACK_ARCHIVE_MAX_BYTES,
    PACK_ID_PATTERN,
    PACK_LOCALE_PATTERN,
    PACK_NS_FILE_MAX_BYTES,
    type TranslationPackManifest,
    translationPackManifestSchema,
} from "./packSchema";
export { isPlainResourceObject, type PackValidationResult, validatePackListing } from "./packValidate";
export { packSourceId, parsePackSourceId, resolveLanguageSource } from "./sources";
export type {
    I18nChangedPayload,
    I18nState,
    LanguageSource,
    LanguageSourceKind,
    PackOverlayMap,
} from "./types";
