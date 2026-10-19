import {
    addPackOverlays,
    BUILTIN_EN_SOURCE_ID,
    bundledI18nResources,
    clearPackOverlays,
    cloneBundledI18nResources,
    DEFAULT_NS,
    I18N_NAMESPACES,
    type I18nChangedPayload,
    type I18nState,
    type PackOverlayMap,
    resolveLanguageSource,
} from "@common/i18n";
import { createMainLogger } from "@electron/util/logger";
import { MainSettings } from "@electron/util/mainSettings";
import i18next, { type i18n as I18nInstance } from "i18next";
import { listLanguageSources, loadOverlayForPackId } from "./packs";

const logger = createMainLogger("i18n/main");

let mainI18n: I18nInstance | null = null;
let activeOverlayNamespaces: string[] = [];

/**
 * Main-process i18next instance. Available after {@link initMainI18n}.
 */
export const getMainI18n = (): I18nInstance => {
    if (!mainI18n) {
        throw new Error("main i18n not initialized");
    }
    return mainI18n;
};

/** Shortcut for main-process `t()`. */
export const mainT = (...args: Parameters<I18nInstance["t"]>): ReturnType<I18nInstance["t"]> =>
    getMainI18n().t(...args);

const clearActiveOverlays = (instance: I18nInstance, locale: string): void => {
    clearPackOverlays(instance, locale, activeOverlayNamespaces, bundledI18nResources);
    activeOverlayNamespaces = [];
};

const applyOverlay = (instance: I18nInstance, locale: string, overlay: PackOverlayMap | null): void => {
    clearActiveOverlays(instance, locale);
    activeOverlayNamespaces = addPackOverlays(instance, locale, overlay);
};

/**
 * Builds the current {@link I18nState} from settings + installed packs (heals invalid source ids).
 */
export const getI18nState = (): I18nState => {
    const sources = listLanguageSources();
    const { source, healed } = resolveLanguageSource(MainSettings.settings.languageSourceId, sources);
    if (healed) {
        logger.warn("languageSourceId missing or invalid; healing to builtin:en", {
            previous: MainSettings.settings.languageSourceId,
        });
        void MainSettings.updateSettings({ languageSourceId: source.id });
    }
    const packId = source.kind === "pack" ? source.packId : undefined;
    const packOverlay = packId ? loadOverlayForPackId(packId) : null;
    /* if pack files vanished, fall back to builtin English */
    if (source.kind === "pack" && !packOverlay) {
        logger.warn("selected pack overlay missing; healing to builtin:en", { sourceId: source.id });
        void MainSettings.updateSettings({ languageSourceId: BUILTIN_EN_SOURCE_ID });
        return {
            sourceId: BUILTIN_EN_SOURCE_ID,
            locale: "en",
            sources: listLanguageSources(),
            packOverlay: null,
        };
    }
    return {
        sourceId: source.id,
        locale: source.locale,
        sources,
        packOverlay: source.kind === "pack" ? packOverlay : null,
    };
};

/**
 * Applies locale + pack overlay on the main i18n instance (does not persist settings).
 * Overlay is applied before `changeLanguage` so the target locale already has resources.
 */
export const applyMainI18nState = async (state: Pick<I18nState, "locale" | "packOverlay">): Promise<void> => {
    const instance = getMainI18n();
    const previousLng = instance.resolvedLanguage ?? instance.language;
    if (previousLng && previousLng !== state.locale) {
        clearActiveOverlays(instance, previousLng);
    }
    applyOverlay(instance, state.locale, state.packOverlay);
    if ((instance.resolvedLanguage ?? instance.language) !== state.locale) {
        await instance.changeLanguage(state.locale);
    }
};

/**
 * Initializes main i18next with bundled English resources, then applies the saved language source.
 */
export const initMainI18n = async (): Promise<I18nState> => {
    mainI18n = i18next.createInstance();
    const preliminary = getI18nState();
    await mainI18n.init({
        lng: "en",
        fallbackLng: "en",
        defaultNS: DEFAULT_NS,
        ns: [...I18N_NAMESPACES],
        resources: cloneBundledI18nResources(),
        interpolation: { escapeValue: false },
        returnNull: false,
    });
    await applyMainI18nState(preliminary);
    logger.info("main i18n initialized", { sourceId: preliminary.sourceId, locale: preliminary.locale });
    return preliminary;
};

/**
 * Payload for broadcasting language changes to renderer windows.
 */
export const toChangedPayload = (state: I18nState): I18nChangedPayload => ({
    sourceId: state.sourceId,
    locale: state.locale,
    packOverlay: state.packOverlay,
});
