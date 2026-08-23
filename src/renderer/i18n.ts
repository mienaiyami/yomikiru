import {
    addPackOverlays,
    bundledI18nResources,
    clearPackOverlays,
    cloneBundledI18nResources,
    DEFAULT_NS,
    I18N_NAMESPACES,
    type I18nChangedPayload,
    type I18nState,
    type PackOverlayMap,
} from "@common/i18n";
import { createRendererLogger } from "@utils/logger";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const log = createRendererLogger("i18n");

let activeOverlayNamespaces: string[] = [];

const clearOverlays = (locale: string): void => {
    clearPackOverlays(i18n, locale, activeOverlayNamespaces, bundledI18nResources);
    activeOverlayNamespaces = [];
};

const applyOverlay = (locale: string, overlay: PackOverlayMap | null): void => {
    clearOverlays(locale);
    activeOverlayNamespaces = addPackOverlays(i18n, locale, overlay);
};

/**
 * Applies a main-process language payload to the renderer i18next instance.
 * Pack overlays are merged before `changeLanguage` so the target locale has resources.
 */
export const applyRendererI18nPayload = async (payload: I18nChangedPayload): Promise<void> => {
    const previous = i18n.resolvedLanguage ?? i18n.language;
    if (previous && previous !== payload.locale) {
        clearOverlays(previous);
    }
    applyOverlay(payload.locale, payload.packOverlay);
    if ((i18n.resolvedLanguage ?? i18n.language) !== payload.locale) {
        await i18n.changeLanguage(payload.locale);
    }
};

/**
 * Initializes renderer i18next with bundled English resources (all namespaces).
 * Pack overlays arrive later via {@link applyRendererI18nPayload}.
 *
 * Do not set `supportedLngs: ["en"]` — that keeps pack locales resolving to English
 * even after overlays are added (verified against i18next 26).
 */
export const initRendererI18n = async (): Promise<void> => {
    await i18n.use(initReactI18next).init({
        lng: "en",
        fallbackLng: "en",
        defaultNS: DEFAULT_NS,
        ns: [...I18N_NAMESPACES],
        resources: cloneBundledI18nResources(),
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
        returnNull: false,
    });

    log.info("renderer i18n initialized");
};

/**
 * Loads persisted language from main and subscribes to {@link i18n:changed}.
 *
 * @returns Unsubscribe for the `i18n:changed` listener
 */
export const syncRendererI18nFromMain = async (): Promise<() => void> => {
    const state: I18nState = await window.electron.invoke("i18n:getState");
    await applyRendererI18nPayload(state);
    return window.electron.on("i18n:changed", (payload) => {
        void applyRendererI18nPayload(payload);
    });
};

export default i18n;
