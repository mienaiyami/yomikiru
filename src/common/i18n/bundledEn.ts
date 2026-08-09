import anilist from "./locales/en/anilist.json";
import common from "./locales/en/common.json";
import dialogs from "./locales/en/dialogs.json";
import electron from "./locales/en/electron.json";
import home from "./locales/en/home.json";
import menu from "./locales/en/menu.json";
import reader from "./locales/en/reader.json";
import settings from "./locales/en/settings.json";
import usage from "./locales/en/usage.json";
import type { I18nNamespace } from "./namespaces";

/** English resources for every app namespace (webpack-imported JSON). */
export const bundledEnResources: Record<I18nNamespace, Record<string, unknown>> = {
    common,
    dialogs,
    menu,
    settings,
    home,
    reader,
    anilist,
    electron,
    usage,
};
