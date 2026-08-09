import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setSettingsOpen } from "@store/ui";
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
import Shortcuts from "./components/Shortcuts";
import ThemeCont from "./components/ThemeCont";
import Usage from "./components/Usage";
import { TAB_INFO } from "./utils/constants";

const log = createRendererLogger("Settings");

type SettingsContext = {
    currentTab: number;
    setCurrentTab: (tab: number) => void;
    nextTab: () => void;
    prevTab: () => void;
    /**
     * Scroll to element with query and set current tab to tab index
     * @param elementQuery query to find element
     * @param tab tab index
     */
    scrollIntoView: (elementQuery: string, tab: keyof typeof TAB_INFO) => void;
};

const SettingsContext = createContext<SettingsContext | null>(null);

export const useSettingsContext = (): SettingsContext => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error("SettingsContext not found");
    return context;
};

//todo: divide into components
const Settings = (): ReactElement => {
    const { t } = useTranslation("settings");
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const isSettingOpen = useAppSelector((store) => store.ui.isOpen.settings);
    /**
     * index of current tab from TAB_INFO
     */
    const [currentTab, setCurrentTab] = useState(0);

    const dispatch = useAppDispatch();

    const settingContRef = useRef<HTMLDivElement>(null);

    const nextTab = useCallback(() => {
        setCurrentTab((init) => (init + 1) % Object.keys(TAB_INFO).length);
    }, []);

    const prevTab = useCallback(() => {
        setCurrentTab((init) => (init - 1 + Object.keys(TAB_INFO).length) % Object.keys(TAB_INFO).length);
    }, []);

    const scrollIntoView = useCallback((elementQuery: string, tab: keyof typeof TAB_INFO) => {
        setCurrentTab(TAB_INFO[tab][0]);
        const onTimeout = () => {
            const elem: HTMLElement | null = document.querySelector(elementQuery);
            if (elem) {
                elem.scrollIntoView({
                    block: "start",
                    behavior: "instant",
                });
                const color = elem.style.backgroundColor;
                elem.style.backgroundColor = "yellow";
                setTimeout(() => {
                    if (elem) elem.style.backgroundColor = color;
                }, 1000);
            } else log.error(`scroll target not found (${elementQuery})`);
        };
        setTimeout(() => {
            onTimeout();
        }, 200);
    }, []);

    useEffect(() => {
        if (isSettingOpen) {
            setTimeout(() => {
                settingContRef.current?.focus();
            }, 300);
        }
    }, [isSettingOpen]);

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
        // could use directly in classname but need focus()
        if (settingContRef.current) {
            settingContRef.current.scrollTop = 0;
        }
        setTimeout(() => {
            settingContRef.current?.focus();
        }, 100);
    }, [currentTab]);

    return (
        <SettingsContext.Provider value={{ currentTab, setCurrentTab, nextTab, prevTab, scrollIntoView }}>
            <FocusLock disabled={!isSettingOpen}>
                <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
                    <div className="clickClose" onClick={() => dispatch(setSettingsOpen(false))}></div>
                    <div className="overflowWrap">
                        <div className="tabMovers">
                            {Object.entries(TAB_INFO).map(([key, value]) => (
                                <button
                                    key={key}
                                    className={`tabBtn ${currentTab === value[0] ? "selected " : ""}`}
                                    onClick={() => setCurrentTab(value[0])}
                                >
                                    {t(value[1])}
                                </button>
                            ))}
                        </div>
                        <div
                            className={"overlayCont settingCont"}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") dispatch(setSettingsOpen(false));
                            }}
                            tabIndex={-1}
                            ref={settingContRef}
                        >
                            <div className={`tab ${currentTab === TAB_INFO.settings[0] ? "selected " : ""}`}>
                                <GeneralSettings />
                            </div>
                            <div className={`tab ${currentTab === TAB_INFO.shortcutKeys[0] ? "selected " : ""}`}>
                                <Shortcuts />
                            </div>
                            <div className={`tab ${currentTab === TAB_INFO.makeTheme[0] ? "selected " : ""}`}>
                                <ThemeCont />
                            </div>
                            <div className={`tab ${currentTab === TAB_INFO.about[0] ? "selected " : ""}`}>
                                <About />
                            </div>
                            <div className={`tab ${currentTab === TAB_INFO.extras[0] ? "selected " : ""}`}>
                                <h1>{t("tabs.usageFeatures")}</h1>
                                <Usage />
                            </div>
                        </div>
                    </div>
                </div>
            </FocusLock>
        </SettingsContext.Provider>
    );
};

export default Settings;
