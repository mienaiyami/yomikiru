import { PAGE_SEARCH_PRIORITY, usePageSearchFocus } from "@renderer/hooks/usePageSearchFocus";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setSettingsOpen } from "@store/ui";
import Combobox, { type ComboboxOption } from "@ui/Combobox";
import { type ReactElement, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SETTINGS_TABS } from "../utils/constants";
import { navigateToSetting } from "../utils/navigateToSetting";
import {
    buildSettingsTargetSearchTexts,
    filterSettingsTargets,
    getAllSettingsTargets,
    isSettingsTargetAvailable,
    type SettingsTarget,
} from "../utils/settingsTargets";

/**
 * Settings chrome search: filters the target catalog (label + keywords + section
 * content) and jumps via {@link navigateToSetting}. Uses {@link Combobox}
 * (Input* + MenuList) and registers with {@link usePageSearchFocus} at overlay priority.
 */
const SettingsSearch = (): ReactElement => {
    const { t, i18n } = useTranslation("settings");
    const { t: tReader } = useTranslation("reader");
    const { t: tUsage } = useTranslation("usage");
    const dispatch = useAppDispatch();
    const isSettingOpen = useAppSelector((s) => s.ui.isOpen.settings);

    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");

    usePageSearchFocus(inputRef, {
        id: "settings-search",
        priority: PAGE_SEARCH_PRIORITY.overlay,
        enabled: isSettingOpen,
    });

    const resolveLabel = (target: SettingsTarget): string => {
        if (target.labelNs === "reader") return tReader(target.labelKey);
        if (target.labelNs === "usage") return tUsage(target.labelKey);
        return t(target.labelKey);
    };

    const tabLabel = (tabKey: SettingsTarget["tab"]): string => {
        const tab = SETTINGS_TABS.find((entry) => entry.key === tabKey);
        return tab ? t(tab.labelKey) : tabKey;
    };

    const groupLabel = (target: SettingsTarget): string => {
        if (!target.groupLabelKey) return tabLabel(target.tab);
        if (target.labelNs === "reader") return tReader(target.groupLabelKey);
        if (target.labelNs === "usage") return tUsage(target.groupLabelKey);
        return t(target.groupLabelKey);
    };

    const getSearchTexts = (target: SettingsTarget): string[] =>
        buildSettingsTargetSearchTexts(target, resolveLabel, (ns, path) =>
            i18n.t(path, { ns, returnObjects: true }),
        );

    const available = getAllSettingsTargets().filter((target) => isSettingsTargetAvailable(target));
    const hits = filterSettingsTargets(available, query, getSearchTexts);

    const options: ComboboxOption[] = hits.map((target) => ({
        value: target.id,
        label: resolveLabel(target),
        description: groupLabel(target),
    }));

    return (
        <div className="settingsSearch">
            <Combobox
                inputRef={inputRef}
                value={query}
                onChange={setQuery}
                options={options}
                onSelect={(id) => {
                    navigateToSetting(id, dispatch);
                    setQuery("");
                }}
                placeholder={t("search.placeholder")}
                emptyMessage={t("search.noResults")}
                onDismiss={() => {
                    // search sits outside .settingCont; close Settings explicitly
                    dispatch(setSettingsOpen(false));
                }}
            />
        </div>
    );
};

export default SettingsSearch;
