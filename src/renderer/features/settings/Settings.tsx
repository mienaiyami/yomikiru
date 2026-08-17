import { useAppDispatch, useAppSelector } from "@store/hooks";
import { clearPendingSettingsNav, setSettingsOpen } from "@store/ui";
import { keyFormatter, mouseEventFormatter } from "@utils/keybindings";
import { createRendererLogger } from "@utils/logger";
import {
    createContext,
    type ReactElement,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import FocusLock from "react-focus-lock";
import { useTranslation } from "react-i18next";
import About from "./components/About";
import GeneralSettings from "./components/GeneralSettings";
import SettingsSearch from "./components/SettingsSearch";
import Shortcuts from "./components/Shortcuts";
import ThemeCont from "./components/ThemeCont";
import Usage from "./components/Usage";
import { SETTINGS_TABS, type SettingsTabKey, settingsTabIndex } from "./utils/constants";
import { highlightSettingsTargetElement, waitForSettingsTargetElement } from "./utils/navigateToSetting";
import { getSettingsTarget } from "./utils/settingsTargets";

const log = createRendererLogger("Settings");

type SettingsContextValue = {
    currentTab: number;
    setCurrentTab: (tab: number) => void;
    nextTab: () => void;
    prevTab: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Settings shell context: current tab index and tab-cycle helpers.
 * Deep-links use {@link navigateToSetting}, not this context.
 */
export const useSettingsContext = (): SettingsContextValue => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error("SettingsContext not found");
    return context;
};

const renderTabPanel = (key: SettingsTabKey, usageTitle: string): ReactElement => {
    switch (key) {
        case "settings":
            return <GeneralSettings />;
        case "shortcutKeys":
            return <Shortcuts />;
        case "makeTheme":
            return <ThemeCont />;
        case "about":
            return <About />;
        case "extras":
            return (
                <>
                    <h1>{usageTitle}</h1>
                    <Usage />
                </>
            );
    }
};

const Settings = (): ReactElement => {
    const { t } = useTranslation("settings");
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const isSettingOpen = useAppSelector((store) => store.ui.isOpen.settings);
    const pendingSettingsNav = useAppSelector((store) => store.ui.pendingSettingsNav);
    /** Index into {@link SETTINGS_TABS}. */
    const [currentTab, setCurrentTab] = useState(0);

    const dispatch = useAppDispatch();

    const settingContRef = useRef<HTMLDivElement>(null);
    const clearHighlightRef = useRef<(() => void) | null>(null);
    /** When true, the next currentTab layout effect skips scrollTop=0 (navigate owns scroll). */
    const skipTabScrollResetRef = useRef(false);

    const nextTab = useCallback(() => {
        setCurrentTab((init) => (init + 1) % SETTINGS_TABS.length);
    }, []);

    const prevTab = useCallback(() => {
        setCurrentTab((init) => (init - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length);
    }, []);

    useEffect(() => {
        if (!isSettingOpen || !pendingSettingsNav) return;

        let cancelled = false;
        const { id } = pendingSettingsNav;
        const target = getSettingsTarget(id);
        if (!target) {
            log.error("pending settings nav: unknown id", { id });
            dispatch(clearPendingSettingsNav());
            return;
        }

        setCurrentTab((prev) => {
            const next = settingsTabIndex(target.tab);
            if (next !== prev) skipTabScrollResetRef.current = true;
            return next;
        });

        void waitForSettingsTargetElement(target.selector).then((elem) => {
            if (cancelled) return;
            if (!elem) {
                log.error("settings nav target not found or hidden", { id, selector: target.selector });
                dispatch(clearPendingSettingsNav());
                return;
            }
            clearHighlightRef.current?.();
            clearHighlightRef.current = highlightSettingsTargetElement(elem);
            dispatch(clearPendingSettingsNav());
        });

        return () => {
            cancelled = true;
        };
    }, [isSettingOpen, pendingSettingsNav, dispatch]);

    useEffect(() => {
        return () => {
            clearHighlightRef.current?.();
        };
    }, []);

    useEffect(() => {
        const handleShortcut = (keyStr: string, e?: Event) => {
            const i = (keys: string[]) => keys.includes(keyStr);
            switch (true) {
                case i(shortcuts.find((s) => s.command === "nextChapter")?.keys || []):
                    e?.preventDefault();
                    nextTab();
                    break;
                case i(shortcuts.find((s) => s.command === "prevChapter")?.keys || []):
                    e?.preventDefault();
                    prevTab();
                    break;
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (!settingContRef.current?.contains(document.activeElement)) return;
            const keyStr = keyFormatter(e);
            if (keyStr === "") return;
            handleShortcut(keyStr, e);
        };
        const onMouseDown = (e: MouseEvent) => {
            if (!settingContRef.current?.contains(e.target as Node)) return;
            const keyStr = mouseEventFormatter(e);
            if (keyStr === "") return;
            handleShortcut(keyStr, e);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("mousedown", onMouseDown);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("mousedown", onMouseDown);
        };
    }, [shortcuts, nextTab, prevTab]);

    useLayoutEffect(() => {
        if (skipTabScrollResetRef.current) {
            skipTabScrollResetRef.current = false;
            return;
        }
        if (settingContRef.current) {
            settingContRef.current.scrollTop = 0;
        }
        const timer = window.setTimeout(() => {
            const body = settingContRef.current;
            if (!body) return;
            // overlay is always mounted; skip while closed so this does not steal page focus
            if (body.closest("#settings")?.getAttribute("data-state") !== "open") return;
            body.focus();
        }, 100);
        return () => window.clearTimeout(timer);
    }, [currentTab]);

    return (
        <SettingsContext.Provider value={{ currentTab, setCurrentTab, nextTab, prevTab }}>
            <FocusLock disabled={!isSettingOpen}>
                <div
                    id="settings"
                    data-state={isSettingOpen ? "open" : "closed"}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") return;
                        // search-field Escape is owned by Combobox (clear vs dismiss)
                        if (e.target instanceof HTMLElement && e.target.closest(".settingsSearch")) return;
                        dispatch(setSettingsOpen(false));
                    }}
                >
                    <div className="clickClose" onClick={() => dispatch(setSettingsOpen(false))}></div>
                    <div className="overflowWrap">
                        <SettingsSearch />
                        <div className="tabMovers">
                            {SETTINGS_TABS.map((tab, index) => (
                                <button
                                    key={tab.key}
                                    className={`tabBtn ${currentTab === index ? "selected " : ""}`}
                                    onClick={() => setCurrentTab(index)}
                                >
                                    {t(tab.labelKey)}
                                </button>
                            ))}
                        </div>
                        <div className={"overlayCont settingCont"} tabIndex={-1} ref={settingContRef}>
                            {SETTINGS_TABS.map((tab, index) => (
                                <div key={tab.key} className={`tab ${currentTab === index ? "selected " : ""}`}>
                                    {renderTabPanel(tab.key, t("tabs.usageFeatures"))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </FocusLock>
        </SettingsContext.Provider>
    );
};

export default Settings;
