import { useAppDispatch } from "@store/hooks";
import { setSettingsOpen } from "@store/ui";
import Combobox, { type ComboboxOption } from "@ui/Combobox";
import { type ReactElement, type RefObject, useState } from "react";
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

type SettingsSearchProps = {
    inputRef: RefObject<HTMLInputElement | null>;
};

/**
 * Settings chrome search: filters the target catalog (label + keywords + section
 * content) and jumps via {@link navigateToSetting}. Slash focuses this field
 * through the Settings command owner.
 */
const SettingsSearch = ({ inputRef }: SettingsSearchProps): ReactElement => {
    const { t, i18n } = useTranslation("settings");
    const { t: tReader } = useTranslation("reader");
    const { t: tUsage } = useTranslation("usage");
    const dispatch = useAppDispatch();
    const [query, setQuery] = useState("");

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
                parentOwnerId="settings"
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
                    dispatch(setSettingsOpen(false));
                }}
            />
        </div>
    );
};

export default SettingsSearch;
