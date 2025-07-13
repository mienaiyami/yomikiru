import {
    createContext,
    ReactElement,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";

import FocusLock from "react-focus-lock";
import ThemeCont from "./components/ThemeCont";
import Shortcuts from "./components/Shortcuts";
import Usage from "./components/Usage";
import { keyFormatter } from "@utils/keybindings";
import GeneralSettings from "./components/GeneralSettings";
import { setSettingsOpen } from "@store/ui";
import { TAB_INFO } from "./utils/constants";
import About from "./components/About";

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
            } else console.error(elementQuery, "not found.");
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
        const keydownEvent = (e: KeyboardEvent) => {
            if (!settingContRef.current?.contains(document.activeElement)) return;
            const keyStr = keyFormatter(e);
            if (keyStr === "") return;
            const i = (keys: string[]) => {
                return keys.includes(keyStr);
            };
            switch (true) {
                case i(shortcuts.find((e) => e.command === "nextChapter")?.keys || []):
                    nextTab();
                    break;
                case i(shortcuts.find((e) => e.command === "prevChapter")?.keys || []):
                    prevTab();
                    break;
            }
        };
        window.addEventListener("keydown", keydownEvent);
        return () => {
            window.removeEventListener("keydown", keydownEvent);
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
                                    {value[1]}
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
                                <h1>Usage & Features</h1>
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
