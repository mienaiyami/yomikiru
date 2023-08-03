import { AppContext } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { faEdit, faLink, faPlus, faSync, faTimes, faTrash, faUnlink } from "@fortawesome/free-solid-svg-icons";
import themesRaw from "../themeInit.json";
import { newTheme, updateTheme, deleteTheme, setTheme, resetAllTheme, addThemes } from "../store/themes";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { resetShortcuts, setShortcuts } from "../store/shortcuts";
import { setOpenSetting } from "../store/isSettingOpen";
import { addBookmark, removeAllBookmarks } from "../store/bookmarks";
import { makeNewSettings, setAppSettings, setEpubReaderSettings, setReaderSettings } from "../store/appSettings";
import { InputSelect } from "./Element/InputSelect";
import InputRange from "./Element/InputRange";
import { promptSelectDir, renderPDF } from "../MainImports";
import { deleteAllHistory } from "../store/history";
import InputNumber from "./Element/InputNumber";
import InputColor from "./Element/InputColor";
import { setAnilistToken } from "../store/anilistToken";
import { setAniLoginOpen } from "../store/isAniLoginOpen";
import InputCheckbox from "./Element/InputCheckbox";
import { setUnzipping } from "../store/unzipping";
import { setLoadingManga } from "../store/isLoadingManga";
import { setLoadingMangaPercent } from "../store/loadingMangaPercent";

const Settings = (): ReactElement => {
    const appSettings = useAppSelector((store) => store.appSettings);
    const theme = useAppSelector((store) => store.theme.name);
    const allThemes = useAppSelector((store) => store.theme.allData);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const isSettingOpen = useAppSelector((store) => store.isSettingOpen);
    const anilistToken = useAppSelector((store) => store.anilistToken);
    // index of tab
    const [currentTab, setCurrentTab] = useState(0);

    const [anilistUsername, setAnilistUsername] = useState("Error");
    const [tempFolder, setTempFolder] = useState(window.electron.app.getPath("temp"));

    //  disabled hardware acceleration
    const [HAValue, setHAValue] = useState(
        window.fs.existsSync(
            window.path.join(window.electron.app.getPath("userData"), "DISABLE_HARDWARE_ACCELERATION")
        ) || false
    );

    const dispatch = useAppDispatch();

    const settingContRef = useRef<HTMLDivElement>(null);

    const currentTheme = useMemo(() => {
        return allThemes.find((e) => e.name === theme)!.main;
    }, [theme]);
    const themeMakerRef = useRef<HTMLDivElement>(null);
    const themeNameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSettingOpen) {
            setTimeout(() => {
                settingContRef.current?.focus();
            }, 300);
        }
    }, [isSettingOpen]);

    useEffect(() => {
        if (tempFolder !== window.electron.app.getPath("temp"))
            try {
                if (window.fs.existsSync(tempFolder)) {
                    window.electron.ipcRenderer.invoke("changeTempPath", tempFolder).then(() => {
                        window.logger.log("Temp path changed to", tempFolder);
                    });
                } else throw new Error("Folder does not exist : " + tempFolder);
            } catch (reason) {
                window.logger.error("Unable to change temp path.", reason);
            }
    }, [tempFolder]);

    useEffect(() => {
        if (anilistToken)
            window.al.getUserName().then((name) => {
                if (name) setAnilistUsername(name);
            });
    }, [anilistToken]);

    const reservedKeys = ["h", "Control", "Tab", "Shift", "Alt", "Escape"];
    const applyThemeTemp = () => {
        const props: ThemeDataMain[] = [...themeMakerRef.current!.getElementsByClassName("newThemeMakerProp")].map(
            (e) => (e as HTMLElement).getAttribute("data-prop") as ThemeDataMain
        );
        let vars = "";
        [...themeMakerRef.current!.getElementsByClassName("newThemeMakerRow")].forEach((e, i) => {
            if (e.getElementsByTagName("label")[0].classList.contains("selected")) {
                vars += `${props[i]}:${
                    (e.getElementsByClassName("newThemeMakerVar")[0] as HTMLInputElement).value
                };`;
            } else {
                vars += `${props[i]}:${
                    (e.getElementsByClassName("newThemeMakerColorFull")[0] as HTMLInputElement).value
                };`;
            }
        });
        document.body.setAttribute("style", vars);
        if (process.platform === "win32")
            window.electron.getCurrentWindow().setTitleBarOverlay({
                color: window.getComputedStyle(document.querySelector("body #topBar")!).backgroundColor,
                symbolColor: window.getComputedStyle(document.querySelector("body #topBar .homeBtns button")!)
                    .color,
                height: Math.floor(40 * window.electron.webFrame.getZoomFactor()),
            });
    };
    const saveTheme = (saveAndReplace = false) => {
        let name = "";
        name = themeNameInputRef.current!.value || window.app.randomString(6);
        if (saveAndReplace) name = theme;
        if (themesRaw.allData.map((e) => e.name).includes(name)) {
            window.dialog.customError({
                title: "Error",
                message: `Can't edit default themes, save as new instead.`,
            });
            return;
        }
        if (!saveAndReplace && allThemes.map((e) => e.name).includes(themeNameInputRef.current!.value)) {
            window.dialog.customError({
                title: "Error",
                message: `Theme name "${themeNameInputRef.current!.value}" already exist, choose something else.`,
            });
            return;
        }
        const props: ThemeDataMain[] = [...themeMakerRef.current!.getElementsByClassName("newThemeMakerProp")].map(
            (e) => (e as HTMLElement).getAttribute("data-prop") as ThemeDataMain
        );
        themeNameInputRef.current!.value = window.app.randomString(6);
        const newThemeData = { ...window.themeProps };
        [...themeMakerRef.current!.getElementsByClassName("newThemeMakerRow")].forEach((e, i) => {
            if (e.getElementsByTagName("label")[0].classList.contains("selected")) {
                newThemeData[props[i]] = (
                    e.getElementsByClassName("newThemeMakerVar")[0] as HTMLInputElement
                ).value;
            } else {
                newThemeData[props[i]] = (
                    e.getElementsByClassName("newThemeMakerColorFull")[0] as HTMLInputElement
                ).value;
            }
        });
        if (saveAndReplace) {
            dispatch(updateTheme({ themeName: name, newThemeData }));
            // setAllThemes((init) => {
            //     init[init.findIndex((e) => e.name === name)].main = newThemeData;
            //     return [...init];
            // });
            return;
        }
        dispatch(newTheme({ name: name, main: newThemeData }));
        // setAllThemes((init) => {
        //     init.push({ name: name, main: newThemeData });
        //     return [...init];
        // });
        dispatch(setTheme(name));
    };

    const ShortcutInput = ({ which, i }: { which: "key1" | "key2"; i: number }) => (
        <input
            type="text"
            value={shortcuts[i][which] === " " ? "Space" : shortcuts[i][which]}
            onKeyDown={(e) => {
                e.stopPropagation();
            }}
            onKeyUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (reservedKeys.includes(e.key)) {
                    window.logger.warn(`"${e.key}"` + " is reserved key.");
                    e.currentTarget.focus();
                    return;
                }
                settingContRef.current?.focus();
                if (e.key === "Backspace") {
                    window.logger.log(`Deleting shortcut ${shortcuts[i].command}.${which}`);
                    dispatch(setShortcuts({ index: i, key: "", which }));
                    return;
                }
                const dupIndex = shortcuts.findIndex((elem) => elem.key1 === e.key || elem.key2 === e.key);
                if (dupIndex >= 0) {
                    window.logger.warn(`"${e.key}" key already bind to "${shortcuts[dupIndex].name}"`);
                    window.dialog.warn({
                        message: `"${e.key}" key already bind to "${shortcuts[dupIndex].name}".`,
                    });
                    return;
                }
                window.logger.log(`Setting shortcut ${shortcuts[i].command}.${which} to "${e.key}"`);
                dispatch(setShortcuts({ index: i, key: e.key, which }));
            }}
            readOnly
            spellCheck={false}
        />
    );
    const ThemeElement = ({ color, prop }: { color: string; prop: ThemeDataMain }): ReactElement => {
        const ref = useRef<HTMLInputElement>(null);
        const [firstRendered, setFirstRendered] = useState(false);
        // ex. #ffffff
        const [rawColor, setRawColor] = useState(color.substring(0, 7));
        // ex. #ffffffff , var(--icon-color)
        const [rawColorWhole, setRawColorWhole] = useState(color);
        const [opacity, setOpacity] = useState(color.length > 7 ? parseInt(color.substring(7), 16) / 2.55 : 100);
        const [checked, setChecked] = useState(color.substring(0, 4) === "var(" ? true : false);

        useEffect(() => {
            setFirstRendered(true);
        }, []);
        useLayoutEffect(() => {
            let base = color;
            while (base && currentTheme[base.replace("var(", "").replace(")", "") as ThemeDataMain]) {
                const clr = currentTheme[base.replace("var(", "").replace(")", "") as ThemeDataMain];
                if (clr.includes("var(")) {
                    base = clr;
                    continue;
                }
                setRawColor(clr.substring(0, 7));
                setOpacity(clr.length > 7 ? parseInt(clr.substring(7), 16) / 2.55 : 100);
                break;
            }
        }, []);
        useLayoutEffect(() => {
            if (firstRendered) {
                // console.log(
                //     prop,
                //     rawColor.substring(0, 7) +
                //         (Math.ceil(opacity * 2.55).toString(16).length < 2
                //             ? "0" + Math.ceil(opacity * 2.55).toString(16)
                //             : Math.ceil(opacity * 2.55).toString(16))
                // );
                // if (process.platform === "win32") {
                //     if (prop === "--icon-color")
                //         window.electron.getCurrentWindow().setTitleBarOverlay({ symbolColor: rawColor });
                //     if (prop === "--topBar-color")
                //         window.electron.getCurrentWindow().setTitleBarOverlay({ color: rawColor });
                // }
                applyThemeTemp();
                // document.body.style.setProperty(
                //     prop,
                //     rawColor.substring(0, 7) +
                //         (Math.ceil(opacity * 2.55).toString(16).length < 2
                //             ? "0" + Math.ceil(opacity * 2.55).toString(16)
                //             : Math.ceil(opacity * 2.55).toString(16))
                // );
            }
        }, [rawColor, opacity, rawColorWhole]);
        // useLayoutEffect(() => {
        //     if (firstRendered) {
        //         // if (process.platform === "win32") {
        //         //     //! fix - change theme without saving
        //         //     if (prop === "--icon-color")
        //         //         window.electron.getCurrentWindow().setTitleBarOverlay({ symbolColor: rawColor });
        //         //     if (prop === "--topBar-color")
        //         //         window.electron.getCurrentWindow().setTitleBarOverlay({ color: rawColor });
        //         // }
        //         // document.body.style.setProperty(prop, rawColorWhole);
        //         applyThemeTemp();
        //     }
        // }, [rawColorWhole]);
        return (
            <>
                <td>
                    <button
                        className="resetBtn"
                        onClick={() => {
                            setChecked(color.substring(0, 4) === "var(" ? true : false);
                            setRawColorWhole(color);
                            setRawColor(color.substring(0, 7));
                            setOpacity(color.length > 7 ? parseInt(color.substring(7), 16) / 2.55 : 100);
                        }}
                        title="Reset"
                    >
                        <FontAwesomeIcon icon={faSync} />
                    </button>
                    <label className={checked ? "selected" : ""} title="Link to variable">
                        <input
                            type="checkbox"
                            defaultChecked={checked}
                            ref={ref}
                            onChange={() => setChecked((init) => !init)}
                        />
                        <FontAwesomeIcon icon={checked ? faUnlink : faLink} />
                    </label>
                </td>
                <td>
                    {checked ? (
                        <InputSelect
                            value={rawColorWhole}
                            className="newThemeMakerVar"
                            onChange={(e) => {
                                setRawColorWhole(e.currentTarget.value);
                            }}
                        >
                            {Object.entries(window.themeProps)
                                .filter((e) => e[0] !== prop)
                                .map((e) => (
                                    <option key={e[0]} value={`var(${e[0]})`}>
                                        {e[1]}
                                    </option>
                                ))}
                        </InputSelect>
                    ) : (
                        <>
                            <InputColor
                                value={rawColor || "#000000"}
                                timeout={[
                                    500,
                                    (value) => setRawColor(value === "" ? "#000000" : value.substring(0, 7)),
                                ]}
                                title="Color"
                            />
                            <InputRange
                                min={0}
                                max={100}
                                value={Math.ceil(opacity) ?? 100}
                                title="Opacity"
                                className="opacityRange"
                                labeled
                                timeout={[200, (value) => setOpacity(value)]}
                            />
                            <input
                                type="text"
                                className="newThemeMakerColorFull"
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                }}
                                value={
                                    rawColor.substring(0, 7) +
                                    Math.round(opacity * 2.55)
                                        .toString(16)
                                        .padStart(2, "0")
                                }
                                style={{ display: "none" }}
                                readOnly
                            />
                        </>
                    )}
                </td>
            </>
        );
    };
    useLayoutEffect(() => {
        // could use directly in classname but need focus()
        if (settingContRef.current) {
            settingContRef.current.scrollTop = 0;
            // const children = [...settingContRef.current.children];
            // children.forEach((e) => e.classList.remove("selected"));
            // const tab = children[currentTab];
            // if (tab) tab.classList.add("selected");
        }
        setTimeout(() => {
            settingContRef.current?.focus();
        }, 100);
    }, [currentTab]);

    const TAB_INFO = {
        settings: [0, "Settings"],
        shortcutKeys: [1, "Shortcut Keys"],
        makeTheme: [2, "Theme Maker"],
        about: [3, "About"],
        extras: [4, "Extras"],
    } as const;

    const scrollIntoView = (elementQuery: string, tab: keyof typeof TAB_INFO) => {
        setCurrentTab(TAB_INFO[tab][0]);
        const onTimeout = () => {
            const elem = document.querySelector(elementQuery) as HTMLElement | null;
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
    };

    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div className="clickClose" onClick={() => dispatch(setOpenSetting(false))}></div>
            <div className="overflowWrap">
                <div className="tabMovers">
                    <button
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                        className={`tabBtn ${currentTab === TAB_INFO.settings[0] ? "selected " : ""}`}
                        onClick={() => setCurrentTab(TAB_INFO.settings[0])}
                    >
                        {TAB_INFO.settings[1]}
                    </button>
                    <button
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                        className={`tabBtn ${currentTab === TAB_INFO.shortcutKeys[0] ? "selected " : ""}`}
                        onClick={() => setCurrentTab(TAB_INFO.shortcutKeys[0])}
                    >
                        {TAB_INFO.shortcutKeys[1]}
                    </button>
                    <button
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                        className={`tabBtn ${currentTab === TAB_INFO.makeTheme[0] ? "selected " : ""}`}
                        onClick={() => setCurrentTab(TAB_INFO.makeTheme[0])}
                    >
                        {TAB_INFO.makeTheme[1]}
                    </button>
                    <button
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                        className={`tabBtn ${currentTab === TAB_INFO.about[0] ? "selected " : ""}`}
                        onClick={() => setCurrentTab(TAB_INFO.about[0])}
                    >
                        {TAB_INFO.about[1]}
                    </button>
                    <button
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                        className={`tabBtn ${currentTab === TAB_INFO.extras[0] ? "selected " : ""}`}
                        onClick={() => setCurrentTab(TAB_INFO.extras[0])}
                    >
                        {TAB_INFO.extras[1]}
                    </button>
                </div>
                <div
                    className={"overlayCont settingCont"}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") dispatch(setOpenSetting(false));
                    }}
                    tabIndex={-1}
                    ref={settingContRef}
                >
                    <div className={`tab ${currentTab === TAB_INFO.settings[0] ? "selected " : ""}`}>
                        {/* <h1>Settings</h1> */}
                        <div className="content2">
                            <div className="settingItem2">
                                <h3>Default Location</h3>
                                {/* <div className="desc">
                                    Default location of home screen Locations tab. Set this to folder where you
                                    store your manga.
                                </div> */}
                                <div className="main row">
                                    <input type="text" value={appSettings.baseDir} readOnly />
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            promptSelectDir((path) =>
                                                dispatch(setAppSettings({ baseDir: path as string }))
                                            );
                                        }}
                                    >
                                        Change Default
                                    </button>
                                </div>
                            </div>
                            <div className="settingItem2" id="settings-theme">
                                <h3>Theme</h3>
                                <div className="main row">
                                    {/* <InputSelect
                                        options={allThemes.map((e) => e.name)}
                                        value={theme}
                                        onChange={(e) => {
                                            dispatch(setTheme(e.currentTarget.value));
                                        }}
                                    /> */}
                                    {allThemes.map((e, i) => (
                                        <div className="themeButtons" key={e.name}>
                                            <button
                                                className={`${theme === e.name ? "selected" : ""} ${
                                                    themesRaw.allData.map((e) => e.name).includes(e.name)
                                                        ? "default"
                                                        : ""
                                                }`}
                                                onClick={() => dispatch(setTheme(e.name))}
                                                title={e.name}
                                            >
                                                {e.name}
                                            </button>
                                            {/* <button
                                                onClick={() => {
                                                    if (e.name === theme) {
                                                        window.dialog.warn({
                                                            message:
                                                                "Choose other theme before deleting this one.",
                                                        });
                                                        return;
                                                    }
                                                    if (themesRaw.allData.map((q) => q.name).includes(e.name)) {
                                                        window.dialog.customError({
                                                            title: "Error",
                                                            message: `Unable to delete default themes.`,
                                                        });
                                                        return;
                                                    }
                                                    window.dialog
                                                        .confirm({
                                                            message: `Delete theme "${e.name}"`,
                                                            noOption: false,
                                                        })
                                                        .then((res) => {
                                                            if (res.response === 0) {
                                                                dispatch(deleteTheme(i));
                                                                // setAllThemes((init) => {
                                                                //     init.splice(i, 1);
                                                                //     return [...init];
                                                                // });
                                                            }
                                                        });
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button> */}
                                        </div>
                                    ))}
                                    <div className="row">
                                        <button
                                            onClick={() => {
                                                setCurrentTab(TAB_INFO.makeTheme[0]);
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faPlus} /> <span className="icon">/</span>{" "}
                                            <FontAwesomeIcon icon={faEdit} />
                                        </button>
                                        {!themesRaw.allData.map((q) => q.name).includes(theme) && (
                                            <button
                                                onClick={() => {
                                                    // if (themesRaw.allData.map((q) => q.name).includes(theme)) {
                                                    //     window.dialog.customError({
                                                    //         title: "Error",
                                                    //         message: `Can't delete default themes.`,
                                                    //     });
                                                    //     return;
                                                    // }
                                                    window.dialog
                                                        .confirm({
                                                            message: `Delete theme "${theme}"`,
                                                            noOption: false,
                                                        })
                                                        .then((res) => {
                                                            if (res.response === 0) {
                                                                const themeIndex = allThemes.findIndex(
                                                                    (e) => e.name === theme
                                                                );
                                                                if (themeIndex > -1 && allThemes[themeIndex - 1]) {
                                                                    dispatch(
                                                                        setTheme(allThemes[themeIndex - 1].name)
                                                                    );
                                                                    dispatch(deleteTheme(themeIndex));
                                                                    // setAllThemes((init) => {
                                                                    //     init.splice(i, 1);
                                                                    //     return [...init];
                                                                    // });
                                                                }
                                                            }
                                                        });
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <hr className="mini" />
                                <div className=" col">
                                    <div className="main row">
                                        <button
                                            onClick={() => {
                                                const opt = window.electron.dialog.showSaveDialogSync(
                                                    window.electron.getCurrentWindow(),
                                                    {
                                                        title: "Export Themes",
                                                        defaultPath: "yomikiru-themes.json",
                                                        filters: [
                                                            {
                                                                name: "json",
                                                                extensions: ["json"],
                                                            },
                                                        ],
                                                    }
                                                );
                                                if (opt == undefined) return;
                                                const themeForExport = allThemes.filter(
                                                    (e) => !themesRaw.allData.map((e) => e.name).includes(e.name)
                                                );
                                                window.fs.writeFileSync(
                                                    opt,
                                                    JSON.stringify(themeForExport, null, "\t")
                                                );
                                            }}
                                        >
                                            Export
                                        </button>
                                        <button
                                            onClick={() => {
                                                const opt = window.electron.dialog.showOpenDialogSync(
                                                    window.electron.getCurrentWindow(),
                                                    {
                                                        properties: ["openFile"],
                                                        filters: [
                                                            {
                                                                name: "Json",
                                                                extensions: ["json"],
                                                            },
                                                        ],
                                                    }
                                                );
                                                if (opt == undefined) return;
                                                const data: ThemeData[] | Themes = JSON.parse(
                                                    window.fs.readFileSync(opt[0], "utf8")
                                                );
                                                const dataToAdd: ThemeData[] = [];
                                                let importedCount = 0;
                                                const existingThemeNames = allThemes.map((e) => e.name);
                                                if (!(data instanceof Array)) {
                                                    if ("name" in data && "allData" in data) {
                                                        data.allData.forEach((e, i) => {
                                                            if ("name" in e && "main" in e) {
                                                                if (
                                                                    existingThemeNames.includes(e.name) ||
                                                                    dataToAdd.map((a) => a.name).includes(e.name)
                                                                ) {
                                                                    window.dialog.warn({
                                                                        message:
                                                                            "Same theme name detected. Wont be imported.\nName: " +
                                                                            e.name,
                                                                    });
                                                                } else {
                                                                    dataToAdd.push(e);
                                                                    importedCount++;
                                                                }
                                                            } else
                                                                window.logger.warn(
                                                                    "IMPORTING THEMES: Invalid data at index",
                                                                    i
                                                                );
                                                        });
                                                    } else {
                                                        window.dialog.customError({
                                                            message: "Data is not in correct format.",
                                                            log: false,
                                                        });
                                                        return;
                                                    }
                                                } else
                                                    data.forEach((e, i) => {
                                                        if ("name" in e && "main" in e) {
                                                            if (
                                                                existingThemeNames.includes(e.name) ||
                                                                dataToAdd.map((a) => a.name).includes(e.name)
                                                            ) {
                                                                window.dialog.warn({
                                                                    message:
                                                                        "Same theme name detected. Wont be imported.\nName: " +
                                                                        e.name,
                                                                });
                                                            } else {
                                                                dataToAdd.push(e);
                                                                importedCount++;
                                                            }
                                                        } else
                                                            window.logger.warn(
                                                                "IMPORTING THEMES: Invalid data at index",
                                                                i
                                                            );
                                                    });
                                                window.dialog.confirm({
                                                    title: "Imported",
                                                    message: "Imported " + importedCount + " themes.",
                                                    noOption: true,
                                                });
                                                dispatch(addThemes(dataToAdd));
                                            }}
                                        >
                                            Import
                                        </button>
                                        <button
                                            onClick={() =>
                                                window.electron.shell.openExternal(
                                                    "https://github.com/mienaiyami/yomikiru/discussions/191"
                                                )
                                            }
                                        >
                                            Get more Themes
                                        </button>
                                    </div>
                                    <div className="desc">
                                        Share your custom theme easily.{" "}
                                        <a
                                            onClick={() => {
                                                scrollIntoView("#settings-usage-copyTheme", "extras");
                                            }}
                                            id="settings-copyTheme"
                                        >
                                            More Info.
                                        </a>
                                    </div>
                                    <div className="main row">
                                        <button
                                            onClick={() => {
                                                const theme = window.electron.clipboard.readText("clipboard");
                                                if (theme) {
                                                    try {
                                                        const themeJSON = JSON.parse(theme);
                                                        if (themeJSON) {
                                                            if ("name" in themeJSON && "main" in themeJSON) {
                                                                if (
                                                                    allThemes
                                                                        .map((e) => e.name)
                                                                        .includes(themeJSON.name)
                                                                ) {
                                                                    window.dialog.warn({
                                                                        message:
                                                                            "Same theme name detected. Wont be imported.\nName: " +
                                                                            themeJSON.name,
                                                                    });
                                                                } else {
                                                                    dispatch(newTheme(themeJSON));
                                                                }
                                                            } else
                                                                window.dialog.customError({
                                                                    title: "Failed",
                                                                    message: `Invalid theme data. Please note that data must be similar to the result of "Copy Current Theme to Clipboard"`,
                                                                });
                                                        }
                                                    } catch (reason) {
                                                        window.dialog.customError({
                                                            title: "Failed",
                                                            message: `Invalid theme data. Please note that data much be similar to the result of "Copy Current Theme to Clipboard"`,
                                                        });
                                                    }
                                                }
                                            }}
                                        >
                                            Save Theme from Clipboard
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                const currentTheme = allThemes.find((e) => e.name === theme);
                                                if (currentTheme) {
                                                    try {
                                                        window.electron.clipboard.writeText(
                                                            JSON.stringify(currentTheme, null, "\t")
                                                        );
                                                        const target = e.currentTarget;
                                                        const oldText = target.innerText;
                                                        target.innerText =
                                                            "\u00a0".repeat(23) + "Copied!" + "\u00a0".repeat(23);
                                                        target.disabled = true;
                                                        setTimeout(() => {
                                                            target.disabled = false;
                                                            target.innerText = oldText;
                                                        }, 3000);
                                                    } catch (reason) {
                                                        window.dialog.customError({
                                                            message: "Failed to copy theme: " + reason,
                                                        });
                                                    }
                                                }
                                            }}
                                        >
                                            Copy Current Theme to Clipboard
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="settingItem2">
                                <h3>Bookmarks</h3>
                                <div className="main row">
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            if (bookmarks.length === 0) {
                                                window.dialog.customError({
                                                    message: "No bookmarks detected.",
                                                    log: false,
                                                });
                                                return;
                                            }
                                            const opt = window.electron.dialog.showSaveDialogSync(
                                                window.electron.getCurrentWindow(),
                                                {
                                                    title: "Export Bookmarks",
                                                    defaultPath: "yomikiru-bookmarks.json",
                                                    filters: [
                                                        {
                                                            name: "json",
                                                            extensions: ["json"],
                                                        },
                                                    ],
                                                }
                                            );
                                            if (opt == undefined) return;
                                            window.fs.writeFileSync(
                                                opt,
                                                JSON.stringify(bookmarks, null, "\t") || JSON.stringify([])
                                            );
                                        }}
                                    >
                                        Export
                                    </button>
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            const opt = window.electron.dialog.showOpenDialogSync(
                                                window.electron.getCurrentWindow(),
                                                {
                                                    properties: ["openFile"],
                                                    filters: [
                                                        {
                                                            name: "Json",
                                                            extensions: ["json"],
                                                        },
                                                    ],
                                                }
                                            );
                                            if (opt == undefined) return;
                                            const data: Manga_BookItem[] = JSON.parse(
                                                window.fs.readFileSync(opt[0], "utf8")
                                            );
                                            const dataToAdd: Manga_BookItem[] = [];
                                            let similarFound = 0;
                                            let importedCount = 0;
                                            if (!(data instanceof Array)) {
                                                window.dialog.customError({
                                                    message:
                                                        "Data is not in correct format. To make sure it is correct, compare it with existing bookmark.json and fix.",
                                                    log: false,
                                                });
                                                return;
                                            }
                                            data.forEach((item) => {
                                                if ("type" in item && "data" in item) {
                                                    if (
                                                        !bookmarks.map((e) => e.data.link).includes(item.data.link)
                                                    ) {
                                                        dataToAdd.push(item);
                                                        importedCount++;
                                                    } else {
                                                        similarFound++;
                                                    }
                                                }
                                            });
                                            if (similarFound > 0)
                                                window.dialog.warn({
                                                    title: "warning",
                                                    message: "Found " + similarFound + " with same link",
                                                });
                                            window.dialog.confirm({
                                                title: "Imported",
                                                message: "Imported " + importedCount + " bookmarks.",
                                                noOption: true,
                                            });
                                            dispatch(addBookmark(dataToAdd));
                                        }}
                                    >
                                        Import
                                    </button>
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            window.dialog
                                                .warn({
                                                    title: "Delete BookMarks",
                                                    message: "Are you sure you want to clear bookmarks?",
                                                    noOption: false,
                                                })
                                                .then(({ response }) => {
                                                    if (response == undefined) return;
                                                    if (response === 1) return;
                                                    if (response === 0) {
                                                        window.dialog
                                                            .warn({
                                                                title: "Delete Bookmarks",
                                                                noOption: false,
                                                                message:
                                                                    "Are you really sure you want to clear bookmarks?\nThis process is irreversible.",
                                                            })
                                                            .then((res) => {
                                                                if (res.response === 1) return;
                                                                dispatch(removeAllBookmarks());
                                                            });
                                                    }
                                                });
                                        }}
                                    >
                                        Delete All Bookmarks
                                    </button>
                                </div>
                            </div>
                            {process.platform === "win32" && (
                                <div className="settingItem2" id="settings-fileExplorerOption">
                                    <h3>File Explorer Option</h3>
                                    <div className="desc">
                                        Add file explorer option (right click menu) to open item in Yomikiru's
                                        reader directly from File Explorer.
                                    </div>
                                    <ul>
                                        <li>
                                            <div className="desc">
                                                For folders, <code>.zip</code>, <code>.cbz</code>, <code>.7z</code>
                                                , <code>.pdf</code> (Opened in Manga/Image Reader)
                                            </div>
                                            <div className="main row">
                                                <button
                                                    onClick={() =>
                                                        window.electron.ipcRenderer.send("addOptionToExplorerMenu")
                                                    }
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        window.electron.ipcRenderer.send(
                                                            "deleteOptionInExplorerMenu"
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </li>
                                        <li>
                                            <div className="desc">
                                                For <code>.epub</code> (Opened in Epub/Text Reader)
                                            </div>
                                            <div className="main row">
                                                <button
                                                    onClick={() =>
                                                        window.electron.ipcRenderer.send(
                                                            "addOptionToExplorerMenu:epub"
                                                        )
                                                    }
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        window.electron.ipcRenderer.send(
                                                            "deleteOptionInExplorerMenu:epub"
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            )}
                            <div className="settingItem2">
                                <h3>AniList</h3>
                                <div className="desc">
                                    Link Yomikiru to your AniList account.{" "}
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-usage-anilist", "extras");
                                        }}
                                    >
                                        More Info
                                    </a>
                                    <br />
                                    NOTE: Yomikiru does not use internet for anything other than app updates if it
                                    is not linked with AniList.
                                </div>
                                <div className="main row">
                                    <button
                                        disabled={anilistToken ? true : false}
                                        onClick={() => {
                                            dispatch(setAniLoginOpen(true));
                                        }}
                                    >
                                        {!anilistToken ? "Login with AniList" : `Logged in as ${anilistUsername}`}
                                    </button>
                                    {anilistToken && (
                                        <button
                                            onClick={() => {
                                                dispatch(setAnilistToken(""));
                                            }}
                                        >
                                            Logout
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="settingItem2" id="settings-pdfScale">
                                <h3>PDF OPTIONS</h3>
                                <div className="desc">
                                    Scales PDF render quality. Higher scale results in higher quality.{" "}
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-usage-pdfScale", "extras");
                                        }}
                                    >
                                        More Info
                                    </a>
                                </div>
                                <div className="main row">
                                    <InputNumber
                                        value={appSettings.readerSettings.pdfScale}
                                        min={0.1}
                                        max={5}
                                        step={0.1}
                                        onChange={(e) => {
                                            let value = e.valueAsNumber;
                                            if (!value) value = 0;
                                            value = value >= 5 ? 5 : value;
                                            value = value <= 0.1 ? 0.1 : value;
                                            dispatch(setReaderSettings({ pdfScale: value }));
                                        }}
                                        labelBefore="SCALE"
                                        className="noBG"
                                    />
                                </div>
                                <div className="desc">
                                    Render your pdf into png for faster loading. It is recommended to set{" "}
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-customTempFolder", "settings");
                                        }}
                                    >
                                        temp folder
                                    </a>{" "}
                                    to something that is not cleaned by your OS. <br />
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-keepExtractedFiles", "settings");
                                        }}
                                    >
                                        Keep Temp Files
                                    </a>{" "}
                                    must be enabled to use this.
                                </div>
                                <div className="main row">
                                    <button
                                        disabled={!appSettings.keepExtractedFiles}
                                        onClick={() => {
                                            promptSelectDir(
                                                (paths) => {
                                                    (async () => {
                                                        if (!(paths instanceof Array && paths.length > 0)) return;
                                                        // dispatch(setLoadingManga(true));
                                                        // dispatch(setLoadingMangaPercent(0));
                                                        for (let i = 0; i < paths.length; i++) {
                                                            const path = paths[i];
                                                            const linkSplitted = path.split(window.path.sep);
                                                            dispatch(
                                                                setUnzipping({
                                                                    state: true,
                                                                    text: `[${i + 1}/${
                                                                        paths.length
                                                                    }] Rendering "${linkSplitted
                                                                        .at(-1)
                                                                        ?.substring(0, 20)}..."`,
                                                                })
                                                            );
                                                            const renderPath = window.path.join(
                                                                window.electron.app.getPath("temp"),
                                                                `yomikiru-temp-images-scale_${
                                                                    appSettings.readerSettings.pdfScale
                                                                }-${linkSplitted.at(-1)}`
                                                            );
                                                            if (window.fs.existsSync(renderPath))
                                                                window.fs.rmSync(renderPath, { recursive: true });
                                                            window.fs.mkdirSync(renderPath);
                                                            console.log(`Rendering "${path}" at "${renderPath}"`);
                                                            try {
                                                                await renderPDF(
                                                                    path,
                                                                    renderPath,
                                                                    appSettings.readerSettings.pdfScale
                                                                );
                                                                // dispatch(
                                                                //     setLoadingMangaPercent(
                                                                //         (i / paths.length) * 100
                                                                //     )
                                                                // );
                                                            } catch (reason: any) {
                                                                console.error(reason);
                                                                if (
                                                                    reason &&
                                                                    reason.message &&
                                                                    !reason.message.includes("password")
                                                                )
                                                                    window.dialog.customError({
                                                                        message: "Error in rendering PDF",
                                                                        detail: path,
                                                                        log: false,
                                                                    });
                                                                // dispatch(
                                                                //     setLoadingMangaPercent(
                                                                //         (i / paths.length) * 100
                                                                //     )
                                                                // );
                                                            }
                                                        }
                                                        // dispatch(setUnzipping(false));
                                                        window.dialog.confirm({
                                                            message: "Rendered all PDFs",
                                                        });
                                                        dispatch(setUnzipping(false));
                                                        // dispatch(setLoadingManga(false));
                                                        // dispatch(setLoadingMangaPercent(0));
                                                    })();
                                                },
                                                true,
                                                [
                                                    {
                                                        extensions: ["pdf"],
                                                        name: "pdf",
                                                    },
                                                ],
                                                true
                                            );
                                        }}
                                    >
                                        Select PDFs to render
                                    </button>
                                </div>
                            </div>
                            <div className="settingItem2" id="settings-customStylesheet">
                                <h3>Custom Stylesheet</h3>
                                <div className="desc">
                                    You can include your custom css stylesheet to change style of app more than
                                    what theme can do.{" "}
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-usage-customStylesheet", "extras");
                                        }}
                                    >
                                        More Info
                                    </a>
                                </div>
                                <div className="main row">
                                    <input
                                        type="text"
                                        placeholder="No File Selected"
                                        value={appSettings.customStylesheet}
                                        readOnly
                                    />
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={(e) => {
                                            promptSelectDir(
                                                (path) => {
                                                    dispatch(setAppSettings({ customStylesheet: path as string }));
                                                    // const target = e.currentTarget;
                                                    // target.innerText = "Applying...";
                                                    // setTimeout(() => {
                                                    //     // window.location.reload();
                                                    //     target.innerText = "Select";
                                                    // }, 1000);
                                                },
                                                true,
                                                [
                                                    {
                                                        extensions: ["css"],
                                                        name: "Cascading Style Sheets",
                                                    },
                                                ]
                                            );
                                        }}
                                    >
                                        Select
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            dispatch(setAppSettings({ customStylesheet: "" }));
                                            // const target = e.currentTarget;
                                            // target.innerText = "Applying...";
                                            // setTimeout(() => {
                                            //     // window.location.reload();
                                            //     target.innerText = "Clear";
                                            // }, 1000);
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="settingItem2" id="settings-customTempFolder">
                                <h3>Custom Temp Folder</h3>
                                <div className="desc">
                                    Folder where app will extract archives or epub or render pdf. It can have big
                                    effect on extracting speed depending on type of drive (ssd, faster drives) or
                                    storage left (10GB+ recommended).
                                    <br /> Defaults to temp folder provided by OS.
                                </div>
                                <div className="main row">
                                    <input
                                        type="text"
                                        placeholder="No path Selected"
                                        value={tempFolder}
                                        readOnly
                                    />
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={(e) => {
                                            promptSelectDir((path) => {
                                                setTempFolder(path as string);
                                            });
                                        }}
                                    >
                                        Select
                                    </button>
                                </div>
                                <div className="main row">
                                    <button
                                        onClick={(e) => {
                                            if (process.env.TEMP) setTempFolder(process.env.TEMP);
                                            else
                                                window.dialog.customError({
                                                    message: "Unable to get default temp path.",
                                                });
                                        }}
                                    >
                                        Use Default
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            const target = e.currentTarget;
                                            target.disabled = true;
                                            window.electron.dialog
                                                .showMessageBox(window.electron.getCurrentWindow(), {
                                                    message: "Clear all extracted/rendered files?",
                                                    checkboxLabel: "Also clear app's cache.",
                                                    buttons: ["Yes", "No"],
                                                    cancelId: 1,
                                                    defaultId: 1,
                                                    type: "question",
                                                })
                                                .then((res) => {
                                                    setTimeout(() => {
                                                        target.disabled = false;
                                                    }, 6000);
                                                    if (res.response === 0) {
                                                        if (res.checkboxChecked) {
                                                            window.electron
                                                                .getCurrentWindow()
                                                                .webContents.session.clearCache();
                                                            window.electron
                                                                .getCurrentWindow()
                                                                .webContents.session.clearCodeCaches({ urls: [] });
                                                        }
                                                        window.fs.readdir(tempFolder, (err, files) => {
                                                            if (err) return window.logger.error(err);
                                                            files
                                                                .filter((e) => e.startsWith("yomikiru"))
                                                                .map((e) => window.path.join(tempFolder, e))
                                                                .forEach(
                                                                    (e) =>
                                                                        window.fs.existsSync(e) &&
                                                                        window.fs.rm(
                                                                            e,
                                                                            { force: true, recursive: true },
                                                                            (err) =>
                                                                                err && window.logger.error(err)
                                                                        )
                                                                );
                                                        });
                                                    }
                                                });
                                        }}
                                    >
                                        Delete all File Cache
                                    </button>
                                </div>
                            </div>
                            <div className="settingItem2 otherSettings">
                                <h3>Other Settings</h3>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.openOnDblClick}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ openOnDblClick: e.currentTarget.checked }));
                                        }}
                                        labelAfter="Open on double-click"
                                    />
                                    <div className="desc">
                                        Open items from home location list in reader on double click.
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={!appSettings.hideOpenArrow}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ hideOpenArrow: !e.currentTarget.checked }));
                                        }}
                                        labelAfter="Open In Reader Arrow / Button"
                                    />
                                    <div className="desc">Show the button beside items in home location list.</div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.askBeforeClosing}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ askBeforeClosing: e.currentTarget.checked })
                                            );
                                        }}
                                        labelAfter="Confirm Close Window"
                                    />
                                    <div className="desc">
                                        Ask for conformation before closing a window.{" "}
                                        <code>App Restart Needed</code>
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.recordChapterRead}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ recordChapterRead: e.currentTarget.checked })
                                            );
                                        }}
                                        labelAfter="Record chapter read"
                                    />
                                    <div className="desc">
                                        Mark opened chapters as read. If chapter is already read, it will appear
                                        with different color in Reader's Side list and Home Locations tab.
                                    </div>
                                </div>
                                <div className="toggleItem" id="settings-openDirectlyFromManga">
                                    <InputCheckbox
                                        checked={appSettings.openDirectlyFromManga}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ openDirectlyFromManga: e.currentTarget.checked })
                                            );
                                        }}
                                        labelAfter="Chapter Opening Shortcut"
                                    />
                                    <div className="desc">
                                        Open chapter directly by clicking name instead of arrow in reader if
                                        chapter folder is in manga folder inside default location.{" "}
                                        <a
                                            onClick={() => {
                                                scrollIntoView("#settings-usage-openDirectlyFromManga", "extras");
                                            }}
                                        >
                                            More Info
                                        </a>
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={!appSettings.readerSettings.disableChapterTransitionScreen}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setReaderSettings({
                                                    disableChapterTransitionScreen: !e.currentTarget.checked,
                                                })
                                            );
                                        }}
                                        labelAfter="Chapter Transition screen"
                                    />
                                    <div className="desc">
                                        Show the chapter transition screen that show up at start and end of chapter
                                        (only in vertical scroll Reading mode).
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={!appSettings.disableListNumbering}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ disableListNumbering: !e.currentTarget.checked })
                                            );
                                        }}
                                        labelAfter="Location List Numbering"
                                    />
                                    <div className="desc">
                                        Enabled Location List Numbering. This will be applied to all lists.
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.showSearch}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ showSearch: e.currentTarget.checked }));
                                        }}
                                        labelAfter="Bookmark / History Search"
                                    />
                                    <div className="desc">Show search bar over bookmarks and history list.</div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.openInZenMode}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ openInZenMode: e.currentTarget.checked }));
                                        }}
                                        labelAfter="Auto Zen Mode"
                                    />
                                    <div className="desc">
                                        Open reader in "Zen Mode" by default. Applies to opening from file explorer
                                        as well.
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.hideCursorInZenMode}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ hideCursorInZenMode: e.currentTarget.checked })
                                            );
                                        }}
                                        labelAfter="Zen Mode Cursor"
                                    />
                                    <div className="desc">Hide cursor in Zen Mode.</div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.showMoreDataOnItemHover}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({
                                                    showMoreDataOnItemHover: e.currentTarget.checked,
                                                })
                                            );
                                        }}
                                        labelAfter="More Info on Bookmark / History Hover"
                                    />
                                    <div className="desc">
                                        Show more info such as "date", "total pages", "last page number", "path"
                                        when mouse over items in bookmark / history tab.
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.autoRefreshSideList}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({
                                                    autoRefreshSideList: e.currentTarget.checked,
                                                })
                                            );
                                        }}
                                        labelAfter="Auto Refresh Side-list"
                                    />
                                    <div className="desc">
                                        Automatically refresh reader-side-list when change in files is detected. It
                                        can be heavy task if you have slow storage and chapter+page count is high.
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.checkboxReaderSetting}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({
                                                    checkboxReaderSetting: e.currentTarget.checked,
                                                })
                                            );
                                        }}
                                        labelAfter="Reader Settings Checkbox"
                                    />
                                    <div className="desc">Show checkbox instead of toggle in reader settings.</div>
                                </div>
                                <div className="toggleItem" id="settings-keepExtractedFiles">
                                    <InputCheckbox
                                        checked={appSettings.keepExtractedFiles}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({
                                                    keepExtractedFiles: e.currentTarget.checked,
                                                })
                                            );
                                        }}
                                        labelAfter="Keep Temp Files"
                                    />
                                    <div className="desc">
                                        Keep temporary files, mainly extracted archives, pdf and epub. Skip
                                        extracting part when opening same title again. <br />
                                        NOTE: If{" "}
                                        <a
                                            onClick={() => {
                                                scrollIntoView("#settings-customTempFolder", "settings");
                                            }}
                                        >
                                            temp folder
                                        </a>{" "}
                                        is set to default then there is a possibility that your system might delete
                                        those files after each power on.
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.useCanvasBasedReader}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ useCanvasBasedReader: e.currentTarget.checked })
                                            );
                                        }}
                                        labelAfter="Canvas Based Rendering"
                                    />
                                    <div className="desc">
                                        Make scrolling smooth and prevent stuttering when reading high res images.
                                        <br />
                                        Drawbacks : high RAM usage and less sharp images when size is set to a low
                                        value.
                                        <code>Experimental</code>
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={appSettings.epubReaderSettings.loadOneChapter}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(
                                                setEpubReaderSettings({ loadOneChapter: e.currentTarget.checked })
                                            );
                                        }}
                                        labelAfter="Epub : Load By Chapter"
                                    />
                                    <div className="desc">
                                        Load and show one chapter at a time (from TOC). If disabled whole epub file
                                        will be displayed (high RAM usage).
                                        <br />
                                        Drawback : Content outside of TOC will not be accessible.
                                    </div>
                                </div>
                                <div className="toggleItem">
                                    <InputCheckbox
                                        checked={!HAValue}
                                        className="noBG"
                                        onChange={(e) => {
                                            const fileName = window.path.join(
                                                window.electron.app.getPath("userData"),
                                                "DISABLE_HARDWARE_ACCELERATION"
                                            );
                                            if (e.currentTarget.checked) {
                                                if (window.fs.existsSync(fileName)) window.fs.rmSync(fileName);
                                            } else {
                                                window.fs.writeFileSync(fileName, " ");
                                            }
                                            setHAValue((init) => !init);
                                        }}
                                        labelAfter="Hardware Acceleration"
                                    />
                                    <div className="desc">
                                        Use GPU to accelerate rendering. Prevents reader stuttering.{" "}
                                        <code>App Restart Needed</code>
                                    </div>
                                </div>
                            </div>
                            <div className="settingItem2 dangerZone">
                                <h3>Reset</h3>
                                <div className="main row">
                                    <button
                                        onClick={() => {
                                            window.dialog
                                                .warn({
                                                    title: "Warning",
                                                    message: "Are you sure you want to clear history?",
                                                    noOption: false,
                                                })
                                                .then((res) => {
                                                    if (res && res.response === 0) dispatch(deleteAllHistory());
                                                });
                                        }}
                                    >
                                        Clear History
                                    </button>
                                    <button
                                        onClick={() => {
                                            window.dialog
                                                .warn({
                                                    title: "Reset themes",
                                                    message: "This will delete all Themes. Continue?",
                                                    noOption: false,
                                                })
                                                .then(({ response }) => {
                                                    if (response == undefined) return;
                                                    if (response === 1) return;
                                                    if (response === 0) {
                                                        window.dialog
                                                            .warn({
                                                                title: "Reset Themes",
                                                                noOption: false,
                                                                message:
                                                                    "Are you really sure you want to delete all Themes?\nThis process is irreversible.",
                                                            })
                                                            .then((res) => {
                                                                if (res.response === 1) return;
                                                                dispatch(resetAllTheme());
                                                            });
                                                    }
                                                });
                                        }}
                                    >
                                        Reset Themes
                                    </button>
                                    <button
                                        onClick={() => {
                                            window.dialog
                                                .warn({
                                                    title: "Warning",
                                                    message: "Reset Shortcuts to default?",
                                                    noOption: false,
                                                })
                                                .then((res) => {
                                                    if (res.response === 0) {
                                                        dispatch(resetShortcuts());
                                                    }
                                                });
                                        }}
                                    >
                                        Reset Shortcuts
                                    </button>
                                    <button
                                        onClick={() => {
                                            window.dialog
                                                .warn({
                                                    title: "Reset Settings",
                                                    message: "This will reset all Settings. Continue?",
                                                    noOption: false,
                                                })
                                                .then(({ response }) => {
                                                    if (response == undefined) return;
                                                    if (response === 1) return;
                                                    if (response === 0) {
                                                        window.dialog
                                                            .warn({
                                                                title: "Reset Settings",
                                                                noOption: false,
                                                                message:
                                                                    "Are you really sure you want to reset settings?\nThis process is irreversible.",
                                                            })
                                                            .then((res) => {
                                                                if (res.response === 1) return;
                                                                dispatch(makeNewSettings());
                                                                dispatch(resetShortcuts());
                                                            });
                                                    }
                                                });
                                        }}
                                    >
                                        Reset Settings
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`tab ${currentTab === TAB_INFO.shortcutKeys[0] ? "selected " : ""}`}>
                        {/* <h1>Shortcut Keys</h1> */}
                        <div className="shortcutKey">
                            <ul>
                                <li>
                                    <code>Backspace</code> to delete Key.
                                </li>
                                <li>
                                    Reserved Keys :{" "}
                                    {reservedKeys.map((e) => (
                                        <span key={e}>
                                            <code>{e}</code>{" "}
                                        </span>
                                    ))}
                                    .
                                </li>
                            </ul>
                            <table>
                                <tbody>
                                    <tr>
                                        <th>Function</th>
                                        <th>Key</th>
                                    </tr>
                                    {shortcuts.map((e, i) => (
                                        <tr key={e.command}>
                                            <td>{e.name}</td>
                                            <td>
                                                <ShortcutInput which="key1" i={i} />
                                                <ShortcutInput which="key2" i={i} />
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td>Home</td>
                                        <td>
                                            <code>h</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            Directory Up
                                            <a
                                                onClick={() => {
                                                    scrollIntoView("#settings-usage-searchShortcutKeys", "extras");
                                                }}
                                            >
                                                More Info.
                                            </a>
                                        </td>
                                        <td>
                                            <code>alt</code>+<code>ArrowUp</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>
                                            Context Menu
                                            <a
                                                onClick={() => {
                                                    scrollIntoView("#settings-usage-searchShortcutKeys", "extras");
                                                }}
                                            >
                                                More Info.
                                            </a>
                                        </td>
                                        <td>
                                            <code>ctrl</code>+<code>/</code> or <code>shift</code>+<code>F10</code>{" "}
                                            or <code>ContextMenu/Menu</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Settings</td>
                                        <td>
                                            <code>ctrl</code>+<code>i</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>New Window</td>
                                        <td>
                                            <code>ctrl</code>+<code>n</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Close Window</td>
                                        <td>
                                            <code>ctrl</code>+<code>w</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Reader width</td>
                                        <td>
                                            <code>ctrl</code>+<code>scroll</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Reload UI</td>
                                        <td>
                                            <code>ctrl</code>+<code>r</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Reload UI and try to clear cache</td>
                                        <td>
                                            <code>ctrl</code>+<code>shift</code>+<code>r</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>UI Scale Up</td>
                                        <td>
                                            <code>ctrl</code> + <code>=</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>UI Scale Down</td>
                                        <td>
                                            <code>ctrl</code> + <code>-</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>UI Scale Reset</td>
                                        <td>
                                            <code>ctrl</code> + <code>0</code>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Dev Tool</td>
                                        <td>
                                            <code>ctrl</code>+<code>shift</code>+<code>i</code>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className={`tab ${currentTab === TAB_INFO.makeTheme[0] ? "selected " : ""}`}>
                        <h1>
                            <span title={theme}>{theme}</span>
                            <input
                                type="text"
                                defaultValue={window.app.randomString(6)}
                                ref={themeNameInputRef}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                }}
                                maxLength={20}
                            />
                            <button
                                onClick={() => {
                                    saveTheme();
                                }}
                            >
                                Save as New
                            </button>
                            <button
                                onClick={() => {
                                    saveTheme(true);
                                }}
                            >
                                Save
                            </button>
                        </h1>
                        <div className="themeMaker" ref={themeMakerRef}>
                            {/* <datalist id="cssColorVariableList">
                                {Object.keys(
                                    allThemes.find((e) => {
                                        return e.name === theme;
                                    })!.main
                                ).map((e) => (
                                    <option key={e} value={`var(${e})`}>{`var(${e})`}</option>
                                ))}
                            </datalist> */}
                            <ul>
                                <li>
                                    To use previously defined color, click on link button and select property frm
                                    dropdown options.
                                </li>
                                <li>
                                    If you want to edit existing theme, click on theme then click on plus icon then
                                    change theme according to your liking.
                                </li>
                                <li>Some changes require refresh.</li>
                            </ul>
                            <table>
                                <tbody>
                                    <tr>
                                        <th>Property</th>
                                        <th>Reset &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Link</th>
                                        <th>Color-Opacity / Variable</th>
                                    </tr>
                                    {Object.entries(window.themeProps).map((e) => (
                                        <tr key={e[0]} className="newThemeMakerRow">
                                            <td className="newThemeMakerProp" data-prop={e[0]}>
                                                {e[1]}
                                            </td>
                                            {/* <td>{e[1]}</td> */}
                                            <ThemeElement
                                                color={
                                                    allThemes.find((e) => e.name === theme)!.main[
                                                        e[0] as ThemeDataMain
                                                    ]
                                                }
                                                prop={e[0] as ThemeDataMain}
                                            />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className={`tab ${currentTab === TAB_INFO.about[0] ? "selected " : ""}`}>
                        <div className="content2">
                            <div className="settingItem2">
                                <h3>Version</h3>
                                <div className="desc">
                                    {window.electron.app.getVersion()}
                                    {" | "}
                                    {process.arch === "x64" ? "64-bit" : "32-bit"}
                                </div>
                                <div className="main col">
                                    <InputCheckbox
                                        className="noBG"
                                        paraAfter="Check for updates on app startup"
                                        checked={appSettings.updateCheckerEnabled}
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({
                                                    updateCheckerEnabled: e.currentTarget.checked,
                                                })
                                            );
                                        }}
                                    />
                                    <InputCheckbox
                                        checked={appSettings.skipMinorUpdate}
                                        className="noBG"
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ skipMinorUpdate: e.currentTarget.checked }));
                                        }}
                                        title="Mostly just frequent updates rather than minor."
                                        paraAfter="Skip minor updates"
                                    />
                                </div>
                                <div className="main row">
                                    <button
                                        onClick={() => {
                                            window.electron.ipcRenderer.send(
                                                "checkForUpdate",
                                                window.electron.getCurrentWindow().id,
                                                true
                                            );
                                        }}
                                    >
                                        Check for Update Now
                                    </button>
                                    <button
                                        onClick={() =>
                                            window.electron.shell.openExternal(
                                                "https://github.com/mienaiyami/yomikiru/releases"
                                            )
                                        }
                                    >
                                        Changelogs
                                    </button>
                                </div>
                            </div>
                            <div className="settingItem2">
                                <h3>Others</h3>
                                {/* <div className="desc"></div> */}
                                <div className="main col">
                                    <button
                                        onClick={() =>
                                            window.electron.shell.openExternal(
                                                "https://github.com/mienaiyami/yomikiru/"
                                            )
                                        }
                                    >
                                        <FontAwesomeIcon icon={faGithub} /> Home Page
                                    </button>
                                    <button
                                        onClick={() =>
                                            window.electron.shell.openExternal(
                                                "https://github.com/mienaiyami/yomikiru/discussions/categories/announcements"
                                            )
                                        }
                                    >
                                        <FontAwesomeIcon icon={faGithub} /> Announcements
                                    </button>
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() =>
                                            window.electron.shell.openExternal(
                                                "https://github.com/mienaiyami/yomikiru/issues"
                                            )
                                        }
                                    >
                                        <FontAwesomeIcon icon={faGithub} /> Submit Issue, Feature Request, Ask
                                        Question
                                    </button>
                                </div>
                                <hr className="mini" />
                                <div className="main col">
                                    <button
                                        onClick={(e) => {
                                            const target = e.currentTarget;
                                            target.innerText =
                                                "\u00a0".repeat(16) + "Copied!" + "\u00a0".repeat(16);
                                            window.electron.clipboard.writeText("mienaiyami0@gmail.com");
                                            target.disabled = true;
                                            setTimeout(() => {
                                                target.disabled = false;
                                                target.innerText = "mienaiyami0@gmail.com";
                                            }, 3000);
                                        }}
                                    >
                                        mienaiyami0@gmail.com
                                    </button>
                                    <button
                                        onClick={() => {
                                            const filePath = window.path.join(
                                                window.electron.app.getPath("userData"),
                                                "logs/main.log"
                                            );
                                            if (process.platform === "win32")
                                                window.electron.shell.showItemInFolder(filePath);
                                            else if (process.platform === "linux")
                                                window.electron.ipcRenderer.send("showInExplorer", filePath);
                                        }}
                                    >
                                        Show Local Logs
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`tab ${currentTab === TAB_INFO.extras[0] ? "selected " : ""}`}>
                        <h1>Usage & Features</h1>
                        <div className="content2 features">
                            <ul>
                                <li>
                                    It is recommended to set "Default Location" to the folder where you usually
                                    store manga.
                                </li>
                                <li>
                                    <b>Recommended File Arrangement:</b> Though you can open manga from anywhere,
                                    it is recommended to arrange file in way as shown below for better experience
                                    and features like "reader side-list".
                                    <ul className="fileExample">
                                        <li>
                                            DEFAULT LOCATION\
                                            <ul>
                                                <li>
                                                    One Piece\
                                                    <ul>
                                                        <li>
                                                            Chapter 1\ <code>use "Open" here</code>
                                                            <ul>
                                                                <li>001.png</li>
                                                                <li>002.png</li>
                                                                <li>003.png</li>
                                                                <li>004.png</li>
                                                            </ul>
                                                        </li>
                                                        <li>
                                                            Chapter 2\
                                                            <ul>
                                                                <li>001.png</li>
                                                            </ul>
                                                        </li>
                                                        <li>Chapter 3.cbz</li>
                                                        <li>Chapter 4.pdf</li>
                                                    </ul>
                                                </li>
                                                <li>
                                                    Bleach\
                                                    <ul>
                                                        <li>
                                                            Chapter 1\ <code>use "Open" here</code>
                                                            <ul>
                                                                <li>001.png</li>
                                                            </ul>
                                                        </li>
                                                        <li>Chapter 2.zip</li>
                                                    </ul>
                                                </li>
                                            </ul>
                                        </li>
                                    </ul>
                                </li>
                                <li>
                                    Drag and Drop support.
                                    <ul>
                                        <li>Dropping a folder will open the reader with that folders content.</li>
                                        <li>
                                            Dropping a supported image file will open its parent folder in the
                                            reader
                                        </li>
                                        <li>Dropping archive or epub file will open them in the reader</li>
                                    </ul>
                                </li>
                                <li id="settings-usage-searchShortcutKeys">
                                    Search bar shortcut keys :
                                    <ul>
                                        <li>
                                            With any search bar focused click <code>ArrowUp</code> or{" "}
                                            <code> ArrowDown</code> to navigate through results.
                                        </li>
                                        <li>
                                            Click <code>Enter</code> to as new search location.
                                        </li>
                                        <li>
                                            Click <code>Enter</code> on empty folder to open in reader.
                                        </li>
                                        <li>
                                            Click <code>alt</code>+<code>ArrowUp</code> to go up a
                                            directory/folder.
                                        </li>
                                        <li>
                                            Click <code>ctrl</code>+<code>/</code> or <code>shift</code>+
                                            <code>F10</code> or <code>ContextMenu/Menu</code> buttons to get right
                                            click menu of focused item.
                                        </li>
                                    </ul>
                                </li>
                                <li>
                                    <b>Home Location tab :</b>
                                    <ul>
                                        <li>
                                            In location tab, click item to see its content or double-click (if
                                            enabled in settings above) to open it in reader.
                                        </li>
                                        <li>
                                            <a
                                                id="settings-usage-openDirectlyFromManga"
                                                onClick={() => {
                                                    scrollIntoView("#settings-openDirectlyFromManga", "settings");
                                                }}
                                            >
                                                Open chapter in reader directly if chapter is a sub-folder of
                                                sub-folder of "Default Location".
                                            </a>
                                            <br />
                                            Example: If the default location is set to{" "}
                                            {process.platform === "win32" ? (
                                                <code>D:\manga</code>
                                            ) : (
                                                <code>/home/manga</code>
                                            )}{" "}
                                            and there is a folder named <code>One Piece</code> within it, any
                                            sub-folder located directly under <code>One Piece</code> will open
                                            automatically by clicking its link in the home location list. If no
                                            images are found then the sub-folder will be opened in location tab
                                            normally.
                                        </li>
                                        <li>
                                            <b>Search:</b>
                                            <ul>
                                                <li>
                                                    You don't need to type the whole word in search. (e.g. For{" "}
                                                    <code>One Piece</code> type <code>op</code>).
                                                </li>
                                                <li>
                                                    For exact search, add <code>"</code> in front of search. (e.g.
                                                    For <code>One Piece</code> type <code>"one</code>).
                                                </li>
                                                <li>
                                                    Paste link to set browse pasted link in Locations tab. Or page
                                                    link of a supported file to open it in reader directly.
                                                </li>
                                                <li>
                                                    Type <code>..{window.path.sep}</code> to go up directory.
                                                </li>
                                                {process.platform === "win32" ? (
                                                    <li>
                                                        Type let <code>D:\</code> to go to <code>D drive</code>.
                                                    </li>
                                                ) : (
                                                    ""
                                                )}
                                                <li>
                                                    Type name ending with <code>{window.path.sep}</code> to open it
                                                    in search. e.g. When there is a directory named{" "}
                                                    <code>One piece</code> in current list, type{" "}
                                                    <code>One Piece{window.path.sep}</code> to open that as new
                                                    list.
                                                </li>
                                            </ul>
                                        </li>
                                    </ul>
                                </li>
                                <li>
                                    Collapse/Un-collapse Bookmarks, History page tabs by clicking on the Dividers
                                    beside them in home screen.
                                </li>
                                <li>
                                    <b>Reader :</b>
                                    <ul>
                                        <li>
                                            When using the "vertical Scroll" mode, you can change chapters on the
                                            first or last page by clicking on either side of the screen or by
                                            clicking "prevPage" (
                                            <code>{shortcuts.find((e) => e.command === "prevPage")?.key1}</code>
                                            {" , "}
                                            <code>{shortcuts.find((e) => e.command === "prevPage")?.key2}</code>)
                                            or "nextPage" (
                                            <code>{shortcuts.find((e) => e.command === "nextPage")?.key1}</code>
                                            {" , "}
                                            <code>{shortcuts.find((e) => e.command === "nextPage")?.key2}</code> )
                                            shortcut keys. No response in center 20% of screen.
                                            <ul>
                                                <li>Left &nbsp;&nbsp;= Previous Chapter</li>
                                                <li>Right = Next Chapter</li>
                                                <li>
                                                    Limit width of images in reader. To use "Max Image Width"
                                                    feature, disable "Size:Clamp".
                                                </li>
                                            </ul>
                                        </li>{" "}
                                        <li>
                                            To scroll using mouse while viewing full page, use "Left to Right" or
                                            "Right to Left" reading mode, then "Fit Vertically" option or make
                                            image size lower than window height.
                                        </li>
                                        <li>
                                            Access the side list by moving the mouse to left side of the screen.
                                            You can pin and resize the side list.
                                        </li>
                                        <li>
                                            Zen Mode (Full Screen Mode): Hides UI, Only shows images and page
                                            number if enabled. Can be enabled using the shortcut key defined,{" "}
                                            <code>
                                                {shortcuts.find((e) => e.command === "toggleZenMode")?.key1}
                                            </code>{" "}
                                            or{" "}
                                            <code>
                                                {shortcuts.find((e) => e.command === "toggleZenMode")?.key2}
                                            </code>
                                            .
                                        </li>
                                        <li>
                                            Double click to toggle zen mode. Working area by reading mode:
                                            <ul>
                                                <li>Vertical Scroll - 100%</li>
                                                <li>Vertical Scroll (chapter start/end) - center 60%</li>
                                                <li>LTR and RTL - center 20%</li>
                                            </ul>
                                        </li>
                                    </ul>
                                </li>
                                <li>
                                    Open chapter directly from the file explorer after enabling{" "}
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-fileExplorerOption", "settings");
                                        }}
                                    >
                                        File Explorer Option
                                    </a>
                                    .
                                    <ul>
                                        <li>
                                            Right Click on folder or .cbz/.7z/.zip/.pdf/.epub
                                            &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Show more options (win11)
                                            &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Open in Yomikiru.
                                        </li>
                                        <li>
                                            Note that this only opens the chapter containing images, not the Manga
                                            Folder.
                                        </li>
                                    </ul>
                                </li>
                                <li>
                                    <a
                                        id="settings-usage-copyTheme"
                                        onClick={() => {
                                            scrollIntoView("#settings-copyTheme", "settings");
                                        }}
                                    >
                                        Copy theme using "Copy Current Theme to Clipboard" under theme
                                    </a>
                                    , it will be copied as text and you can share it anywhere. To install the
                                    theme, copy whole text you received and click on "Save Theme from Clipboard".
                                </li>
                                <li>
                                    <a
                                        id="settings-usage-pdfScale"
                                        onClick={() => {
                                            scrollIntoView("#settings-pdfScale", "settings");
                                        }}
                                    >
                                        <b>PDF Scale:</b>
                                    </a>{" "}
                                    Set the quality of the images. Higher number means higher quality but also high
                                    initial cpu and storage usage. <br />
                                    <b>Do not use high scale with pdf which have high page count.</b>
                                </li>
                                <li id="settings-usage-anilist">
                                    <b>AniList Tracking : </b>
                                    <ul>
                                        <li>
                                            After logging in successfully you can enable tracking by opening a
                                            manga and checking side-list (moving mouse to left most part of app).
                                        </li>
                                        <li>
                                            Tracker are managed according to the folder of manga. If manga folder
                                            is moved/renamed/deleted local tracker will be remove and user will
                                            need to add tracker again.
                                        </li>
                                        <li>
                                            Currently you need to manually update the progress entry but auto
                                            updating of tracker will be supported soon.
                                        </li>
                                    </ul>
                                </li>
                                <li id="settings-usage-customStylesheet">
                                    If you know how to write <code>.css</code>, you can customize style of app,
                                    more than just theme color that is enabled by "Theme Maker, by making your
                                    custom <code>.css</code> file and adding it as{" "}
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-customStylesheet", "settings");
                                        }}
                                    >
                                        Custom Stylesheet
                                    </a>
                                    . You can use developer/inspect tool to check the element and existing styles.
                                    <br />
                                    NOTE: Do not move <code> .css </code> file in directly under app's folder. If
                                    you are using portable version, everything except <code>userdata</code> folder
                                    will be deleted. You can safely put it inside <code>userdata</code> folder.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
