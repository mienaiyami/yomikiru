import { AppContext } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { faEdit, faLink, faPlus, faSync, faTimes, faTrash, faUnlink } from "@fortawesome/free-solid-svg-icons";
import themesRaw from "../themeInit.json";
import { newTheme, updateTheme, deleteTheme, setTheme, resetAllTheme } from "../store/themes";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { resetShortcuts, setShortcuts } from "../store/shortcuts";
import { setOpenSetting } from "../store/isSettingOpen";
import { addBookmark, removeAllBookmarks } from "../store/bookmarks";
import { makeNewSettings, setAppSettings, setReaderSettings } from "../store/appSettings";

const Settings = (): ReactElement => {
    const { promptSetDefaultLocation } = useContext(AppContext);
    const appSettings = useAppSelector((store) => store.appSettings);
    const theme = useAppSelector((store) => store.theme.name);
    const allThemes = useAppSelector((store) => store.theme.allData);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const isSettingOpen = useAppSelector((store) => store.isSettingOpen);

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

    const reservedKeys = ["h", "Control", "Tab", "Shift", "Alt", "Escape"];
    const saveTheme = (saveAndReplace = false) => {
        let name = "";
        if (themeNameInputRef.current!.value === "") name = window.app.randomString(6);
        if (saveAndReplace) name = theme;
        else name = themeNameInputRef.current!.value;
        if (themesRaw.allData.map((e) => e.name).includes(name)) {
            window.dialog.customError({
                title: "Error",
                message: `Unable to edit default themes, save as new instead.`,
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
            (e) => (e as HTMLElement).innerText as ThemeDataMain
        );
        themeNameInputRef.current!.value = window.app.randomString(6);
        const newThemeData = { ...window.themeProps };
        [...themeMakerRef.current!.getElementsByClassName("newThemeMakerRow")].forEach((e, i) => {
            if (e.getElementsByTagName("label")[0].classList.contains("selected")) {
                newThemeData[props[i]] = (
                    e.getElementsByClassName("newThemeMakerColorOrVar")[0] as HTMLInputElement
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
                if (process.platform === "win32") {
                    if (prop === "--icon-color")
                        window.electron.getCurrentWindow().setTitleBarOverlay({ symbolColor: rawColor });
                    if (prop === "--topBar-color")
                        window.electron.getCurrentWindow().setTitleBarOverlay({ color: rawColor });
                }
                document.body.style.setProperty(
                    prop,
                    rawColor.substring(0, 7) +
                        (Math.ceil(opacity * 2.55).toString(16).length < 2
                            ? "0" + Math.ceil(opacity * 2.55).toString(16)
                            : Math.ceil(opacity * 2.55).toString(16))
                );
            }
        }, [rawColor, opacity]);
        // todo : make similar system for rawColorWhole
        return (
            <>
                <td>
                    <button
                        className="resetBtn"
                        onClick={() => {
                            setRawColor(color);
                            setOpacity(color.length > 7 ? parseInt(color.substring(7), 16) / 2.55 : 100);
                            setRawColorWhole(color);
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
                        <input
                            type="text"
                            value={rawColorWhole}
                            list="cssColorVariableList"
                            spellCheck={false}
                            className="newThemeMakerColorOrVar"
                            onChange={(e) => {
                                setRawColorWhole(e.target.value);
                            }}
                        />
                    ) : (
                        <>
                            <input
                                type="color"
                                value={rawColor || "#000000"}
                                // className="newThemeMakerColor"
                                onChange={(e) => {
                                    setRawColor(
                                        e.target.value === "" ? "#000000" : e.target.value.substring(0, 7)
                                    );
                                }}
                                title="Color"
                            />
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.ceil(opacity) ?? 100}
                                title="Opacity"
                                // className="newThemeMakerOpacity"
                                onChange={(e) => {
                                    setOpacity(() => {
                                        if (e.target.value === "") {
                                            e.target.value = "0";
                                        }
                                        const value = e.target.valueAsNumber ?? 100;
                                        return value;
                                    });
                                }}
                            />
                            <input
                                type="text"
                                className="newThemeMakerColorFull"
                                value={
                                    rawColor.substring(0, 7) +
                                    (Math.ceil(opacity * 2.55).toString(16).length < 2
                                        ? "0" + Math.ceil(opacity * 2.55).toString(16)
                                        : Math.ceil(opacity * 2.55).toString(16))
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

    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div className="clickClose" onClick={() => dispatch(setOpenSetting(false))}></div>
            <div
                className={"cont"}
                onKeyDown={(e) => {
                    if (e.key === "Escape") dispatch(setOpenSetting(false));
                }}
                tabIndex={-1}
                ref={settingContRef}
            >
                <h1>
                    Settings
                    <button onClick={() => dispatch(setOpenSetting(false))} className="closeBtn">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </h1>
                <table className="content">
                    <tbody>
                        <tr className="settingItem">
                            <td className="name">Default Location</td>
                            <td className="current">
                                <input type="text" value={appSettings.baseDir} readOnly />
                                <button
                                    // onFocus={(e) => e.currentTarget.blur()}
                                    onClick={() => {
                                        promptSetDefaultLocation();
                                    }}
                                >
                                    Change Default
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem exportBookmark">
                            <td className="name">Bookmarks</td>
                            <td className="current">
                                <button
                                    // onFocus={(e) => e.currentTarget.blur()}
                                    onClick={() => {
                                        const opt = window.electron.dialog.showSaveDialogSync(
                                            window.electron.getCurrentWindow(),
                                            {
                                                title: "Export Bookmarks",
                                                defaultPath: "bookmarks.json",
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
                                        const data: ChapterItem[] = JSON.parse(
                                            window.fs.readFileSync(opt[0], "utf8")
                                        );
                                        const dataToAdd: ChapterItem[] = [];
                                        let similarFound = 0;
                                        data.forEach((item) => {
                                            if (("mangaName" && "link" && "chapterName") in item) {
                                                if (!bookmarks.map((e) => e.link).includes(item.link)) {
                                                    dataToAdd.push(item);
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
                                                message: "are you sure you want to remove bookmark?",
                                                noOption: false,
                                            })
                                            .then(({ response }) => {
                                                if (response == undefined) return;
                                                if (response === 1) return;
                                                if (response === 0) {
                                                    window.dialog
                                                        .warn({
                                                            title: "Delete BookMarks",
                                                            noOption: false,
                                                            message:
                                                                "are you really sure you want to remove bookmark?\nThis process is irreversible.",
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
                            </td>
                        </tr>
                        <tr className="settingItem themeSelector">
                            <td className="name">Theme</td>
                            <td className="current">
                                {/* <p>
                                        Add custom theme by adding new item with changed css variable in <br />
                                        <span className="copy">
                                            {window.path.join(window.electron.app.getPath("userData"), "themes.json")}
                                        </span>
                                    </p> */}
                                {allThemes.map((e, i) => (
                                    <div className="themeButtons" key={e.name}>
                                        <button
                                            className={theme === e.name ? "selected" : ""}
                                            onClick={() => dispatch(setTheme(e.name))}
                                        >
                                            {e.name}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (e.name === theme) {
                                                    window.dialog.warn({
                                                        message: "Choose other theme before deleting this one.",
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
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => {
                                        themeMakerRef.current?.focus();
                                        themeMakerRef.current?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                        });
                                    }}
                                >
                                    <FontAwesomeIcon icon={faPlus} /> / <FontAwesomeIcon icon={faEdit} />
                                </button>
                            </td>
                        </tr>
                        {process.platform === "win32" ? (
                            <tr className="settingItem">
                                <td className="name">File Explorer Option </td>
                                <td className="current">
                                    <button
                                        onClick={() => window.electron.ipcRenderer.send("addOptionToExplorerMenu")}
                                    >
                                        Add
                                    </button>
                                    <button
                                        onClick={() =>
                                            window.electron.ipcRenderer.send("deleteOptionInExplorerMenu")
                                        }
                                    >
                                        Remove
                                    </button>
                                    <button
                                        onClick={() =>
                                            window.electron.ipcRenderer.send("deleteOldOptionInExplorerMenu")
                                        }
                                    >
                                        Remove(Old version)
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            ""
                        )}
                        <tr className="settingItem">
                            <td className="name">Check for Update</td>
                            <td className="current">
                                <label className={appSettings.updateCheckerEnabled ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.updateCheckerEnabled}
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ updateCheckerEnabled: e.currentTarget.checked })
                                            );
                                        }}
                                    />
                                    <p>Check on Startup</p>
                                </label>
                                <button
                                    onClick={() => {
                                        window.electron.ipcRenderer.send(
                                            "checkForUpdate",
                                            window.electron.getCurrentWindow().id,
                                            true
                                        );
                                    }}
                                >
                                    Check for Update
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Other Settings</td>
                            <td className="current list">
                                <label className={appSettings.skipMinorUpdate ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.skipMinorUpdate}
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ skipMinorUpdate: e.currentTarget.checked }));
                                        }}
                                    />
                                    <p>Skip minor updates.</p>
                                </label>
                                <label className={appSettings.openOnDblClick ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.openOnDblClick}
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ openOnDblClick: e.currentTarget.checked }));
                                        }}
                                    />
                                    <p>Open in Reader on double-click.</p>
                                </label>
                                <label className={appSettings.askBeforeClosing ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.askBeforeClosing}
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ askBeforeClosing: e.currentTarget.checked })
                                            );
                                        }}
                                    />
                                    <p>Ask before closing window? (Needs Restart).</p>
                                </label>
                                <label className={appSettings.recordChapterRead ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.recordChapterRead}
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ recordChapterRead: e.currentTarget.checked })
                                            );
                                        }}
                                    />
                                    <p>
                                        Record chapter read. If chapter is already read, it will appear with
                                        different color in reader-side-list and home.
                                    </p>
                                </label>
                                <label className={appSettings.openDirectlyFromManga ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.openDirectlyFromManga}
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ openDirectlyFromManga: e.currentTarget.checked })
                                            );
                                        }}
                                    />
                                    <p>
                                        Open chapter directly by clicking name instead of arrow in reader if
                                        chapter folder is in manga folder inside <code>default location</code>.
                                    </p>
                                </label>
                                <label
                                    className={
                                        appSettings.readerSettings.disableChapterTransitionScreen ? "selected" : ""
                                    }
                                >
                                    <input
                                        type="checkbox"
                                        checked={appSettings.readerSettings.disableChapterTransitionScreen}
                                        onChange={(e) => {
                                            dispatch(
                                                setReaderSettings({
                                                    disableChapterTransitionScreen: e.currentTarget.checked,
                                                })
                                            );
                                        }}
                                    />
                                    <p>
                                        Disable the screen that appears at start and end of chapters only in{" "}
                                        <code>vertical scroll</code> Reading mode.
                                    </p>
                                </label>
                                <label className={appSettings.useCanvasBasedReader ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.useCanvasBasedReader}
                                        onChange={(e) => {
                                            dispatch(
                                                setAppSettings({ useCanvasBasedReader: e.currentTarget.checked })
                                            );
                                        }}
                                    />
                                    <p>
                                        Make scrolling smooth and prevent stuttering when reading high res images.
                                        <br />
                                        Drawbacks include high RAM usage and less crispy images when size is set to
                                        a low value.(BETA)
                                    </p>
                                </label>
                                <button
                                    onClick={() => {
                                        window.dialog
                                            .warn({
                                                title: "Reset themes",
                                                message: "This will delete all themes. Continue?",
                                                noOption: false,
                                            })
                                            .then(({ response }) => {
                                                if (response == undefined) return;
                                                if (response === 1) return;
                                                if (response === 0) dispatch(resetAllTheme());
                                            });
                                    }}
                                >
                                    Reset all themes
                                </button>
                                <button
                                    onClick={() => {
                                        window.dialog
                                            .warn({
                                                title: "Reset Settings",
                                                message:
                                                    "This will reset all Settings (themes not included). Continue?",
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
                                    Reset all Settings
                                </button>
                                {/* <label className={appSettings.disableCachingCanvas ? "selected" : ""}>
                                        <input
                                            type="checkbox"
                                            disabled={!appSettings.useCanvasBasedReader}
                                            checked={appSettings.disableCachingCanvas}
                                            onChange={(e) => {
                                                setAppSettings((init) => {
                                                    init.disableCachingCanvas = e.currentTarget.checked;
                                                    return {...init}
                                                    
                                                });
                                            }}
                                        />
                                        <p>
                                            Enable low RAM usage. <br />
                                            Drawbacks include high time lag when switching <code>Reading mode</code> or{" "}
                                            <code>Page per Row</code>.
                                        </p>
                                    </label> */}
                            </td>
                        </tr>
                        {/* <div className="settingItem version">
                                <div className="name">Others:</div>
                                <div className="current">
                                    <label>
                                        <input type="checkbox" />
                                        <p>Show Loading Screen</p>
                                    </label>
                                </div>
                            </div> */}
                    </tbody>
                </table>
                <h1>About</h1>
                <table className="content">
                    <tbody>
                        <tr className="settingItem">
                            <td className="name">Version </td>
                            <td className="current">
                                <span>{window.electron.app.getVersion()}</span>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Home</td>
                            <td className="current">
                                <button
                                    onClick={() =>
                                        window.electron.shell.openExternal(
                                            "https://github.com/mienaiyami/yomikiru/"
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon={faGithub} /> Home Page
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Issues/Feature Request</td>
                            <td className="current">
                                <button
                                    // onFocus={(e) => e.currentTarget.blur()}
                                    onClick={() =>
                                        window.electron.shell.openExternal(
                                            "https://github.com/mienaiyami/yomikiru/issues/new/choose"
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon={faGithub} /> Submit Issue / Feature Request
                                </button>
                                <button
                                    onClick={(e) => {
                                        const target = e.currentTarget;
                                        target.innerText = "Copied!";
                                        window.electron.clipboard.writeText("mienaiyami0@gmail.com");
                                        setTimeout(() => {
                                            target.innerText = "mienaiyami0@gmail.com";
                                        }, 3000);
                                    }}
                                >
                                    mienaiyami0@gmail.com
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Author</td>
                            <td className="current">
                                <button
                                    onClick={() =>
                                        window.electron.shell.openExternal("https://github.com/mienaiyami/")
                                    }
                                >
                                    <FontAwesomeIcon icon={faGithub} /> MienaiYami
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Logs</td>
                            <td className="current">
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
                                    Open Logs
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
                            </td>
                        </tr>
                    </tbody>
                </table>
                <h1>Usage & Features</h1>
                <div className="content features">
                    <ul>
                        <li>
                            In location tab, click item to see its content or double-click to open it in reader.
                        </li>
                        <li>
                            Collapse/Un-collapse Bookmarks, History page tabs by clicking on the Dividers beside
                            them in home screen.
                        </li>
                        <li>
                            You don't need to type the whole word in search. (e.g. For <code>One Piece</code> type{" "}
                            <code>op</code>).
                        </li>
                        <li>
                            When using the <code>vertical Scroll</code> mode, you can change chapters on the first
                            or last page by clicking on either side of the screen. No response in center 20% of
                            screen.
                            <ul>
                                <li>Left &nbsp;&nbsp;= Previous Chapter</li>
                                <li>Right = Next Chapter</li>
                            </ul>
                        </li>
                        <li>
                            Access the side list by moving the mouse to left side of the screen. You can pin and
                            resize the side list.
                        </li>
                        <li>
                            Open chapter directly from the file explorer after enabling{" "}
                            <code>File Explorer Option</code>.
                            <ul>
                                <li>
                                    Right Click on folder or .cbz/.zip &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Show more
                                    options(win11) &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Open in Yomikiru.
                                </li>
                                <li>
                                    Note that this only opens the chapter containing images, not the Manga Folder.
                                </li>
                            </ul>
                        </li>
                        <li>
                            Zen Mode (Full Screen Mode): Hides UI, Only shows images and page number if enabled.{" "}
                        </li>
                        <li>
                            Open chapter in reader directly if chapter is a sub-folder of sub-folder of{" "}
                            <code>Default Location</code>.
                            <br />
                            Example: If the default location is set to{" "}
                            {process.platform === "win32" ? <code>D:\manga</code> : <code>/home/manga</code>} and
                            there is a folder called <code>One Piece</code> within it, any sub-folder located
                            directly under <code>One Piece</code> will open automatically by clicking its link in
                            the home location list. This feature can be enabled in the settings.
                        </li>
                        <li>
                            Home screen search:
                            <ul>
                                <li>Paste link to set browser pasted link directly.</li>
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
                                    Type name ending with <code>{window.path.sep}</code> to open it in search. e.g.
                                    When there is a directory named <code>One piece</code> in current list, type{" "}
                                    <code>One Piece{window.path.sep}</code> to open that as new list.
                                </li>
                            </ul>
                        </li>
                        <li>
                            Limit width of images in reader. To use <code>Max Image Width</code> feature, disable{" "}
                            <code>Size Clamp</code>.
                        </li>
                    </ul>
                </div>
                <h1>
                    Shortcut Keys{" "}
                    <button
                        onClick={() => {
                            window.dialog
                                .confirm({
                                    title: "Confirm",
                                    message: "Reset Shortcuts to default?",
                                    noOption: false,
                                })
                                .then((res) => {
                                    if (res.response === 0) {
                                        dispatch(resetShortcuts());
                                    }
                                });
                        }}
                        title="Reset"
                    >
                        <FontAwesomeIcon icon={faSync} />
                    </button>
                </h1>
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
                                <td>New Window</td>
                                <td>
                                    <code>ctrl</code>+<code>n</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Reader width</td>
                                <td>
                                    <code>ctrl</code>+<code>scroll</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Home</td>
                                <td>
                                    <code>h</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Reload</td>
                                <td>
                                    <code>ctrl</code>+<code>r</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Dev Tool</td>
                                <td>
                                    <code>ctrl</code>+<code>shift</code>+<code>i</code>
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
                        </tbody>
                    </table>
                </div>
                <h1>
                    Make Theme
                    <input
                        type="text"
                        defaultValue={window.app.randomString(6)}
                        ref={themeNameInputRef}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                        }}
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
                    <datalist id="cssColorVariableList">
                        {Object.keys(
                            allThemes.find((e) => {
                                return e.name === theme;
                            })!.main
                        ).map((e) => (
                            <option key={e} value={`var(${e})`}>{`var(${e})`}</option>
                        ))}
                    </datalist>
                    <ul>
                        <li>
                            To use previously defined color, click on link button then type it like this,{" "}
                            <code>var(--body-bg)</code> in input box. Or you can type also hex color in it as well{" "}
                            <code>#RRGGBBAA</code>.
                        </li>
                        <li>
                            If you want to edit existing theme, click on theme then click on plus icon then change
                            theme according to your liking.
                        </li>
                    </ul>
                    <table>
                        <tbody>
                            <tr>
                                <th>Property</th>
                                <th>Reset &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Link</th>
                                <th>Color-Opacity / Variable</th>
                            </tr>
                            {Object.entries(allThemes.find((e) => e.name === theme)!.main).map((e) => (
                                <tr key={e[0]} className="newThemeMakerRow">
                                    <td className="newThemeMakerProp">{e[0]}</td>
                                    {/* <td>{e[1]}</td> */}
                                    <ThemeElement color={e[1]} prop={e[0] as ThemeDataMain} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Settings;
