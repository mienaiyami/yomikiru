/**
 * App translation namespaces. Feature screens load their own ns; shared chrome uses {@link DEFAULT_NS}.
 */
export const I18N_NAMESPACES = [
    "common",
    "dialogs",
    "menu",
    "settings",
    "home",
    "reader",
    "anilist",
    "electron",
    "usage",
] as const;

/** Namespace id used by `t()` when no ns is specified. */
export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

/** Default i18next namespace (`common`). */
export const DEFAULT_NS: I18nNamespace = "common";

/** True when `ns` is a known app namespace. */
export const isI18nNamespace = (ns: string): ns is I18nNamespace =>
    (I18N_NAMESPACES as readonly string[]).includes(ns);
