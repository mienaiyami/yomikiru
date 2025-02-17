import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { faEdit, faHeart, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import themesRaw from "../themeInit.json";
import { newTheme, deleteTheme, setTheme, resetAllTheme, addThemes } from "../store/themes";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { resetShortcuts } from "../store/shortcuts";
import { setOpenSetting } from "../store/isSettingOpen";
import { addBookmark, removeAllBookmarks } from "../store/bookmarks";
import { makeNewSettings, setAppSettings, setEpubReaderSettings, setReaderSettings } from "../store/appSettings";
import { promptSelectDir } from "../utils/main";
import { deleteAllHistory } from "../store/history";
import InputNumber from "./Element/InputNumber";
import { setAnilistToken } from "../store/anilistToken";
import { setAniLoginOpen } from "../store/isAniLoginOpen";
import InputCheckbox from "./Element/InputCheckbox";
import { setUnzipping } from "../store/unzipping";

import FocusLock from "react-focus-lock";
import ThemeCont from "./settings/ThemeCont";
import Shortcuts from "./settings/Shortcuts";
import Usage from "./settings/Usage";
import { renderPDF } from "../utils/pdf";

const TAB_INFO = {
    settings: [0, "Settings"],
    shortcutKeys: [1, "Shortcut Keys"],
    makeTheme: [2, "Theme Maker"],
    about: [3, "About"],
    extras: [4, "Extras"],
} as const;

//todo: divide into components
const Settings = (): ReactElement => {
    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const theme = useAppSelector((store) => store.theme.name);
    const allThemes = useAppSelector((store) => store.theme.allData);
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const isSettingOpen = useAppSelector((store) => store.isSettingOpen);
    const anilistToken = useAppSelector((store) => store.anilistToken);
    const [currentTab, setCurrentTab] = useState(0);

    const [anilistUsername, setAnilistUsername] = useState("Error");
    const [tempFolder, setTempFolder] = useState(window.electron.app.getPath("temp"));

    //todo make a better way to do this
    const [HAValue, setHAValue] = useState(
        window.fs.existsSync(
            window.path.join(window.electron.app.getPath("userData"), "DISABLE_HARDWARE_ACCELERATION")
        ) || false
    );
    const [openInSameWindow, setOpenInSameWindow] = useState(
        window.fs.existsSync(
            window.path.join(window.electron.app.getPath("userData"), "OPEN_IN_EXISTING_WINDOW")
        ) || false
    );

    const dispatch = useAppDispatch();

    const settingContRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isSettingOpen) {
            setTimeout(() => {
                settingContRef.current?.focus();
            }, 300);
        }
    }, [isSettingOpen]);

    useEffect(() => {
        //todo extract to hook?
        // const shortcutsMapped = Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<
        //     ShortcutCommands,
        //     string[]
        // >;
        const keydownEvent = (e: KeyboardEvent) => {
            const keyStr = window.keyFormatter(e);
            if (keyStr === "") return;
            const i = (keys: string[]) => {
                return keys.includes(keyStr);
            };
            const maxTabLength = Object.keys(TAB_INFO).length;
            switch (true) {
                case i(shortcuts.find((e) => e.command === "nextChapter")?.keys || []):
                    // case i(shortcutsMapped["nextChapter"]):
                    setCurrentTab((init) => (init + 1) % maxTabLength);
                    break;
                case i(shortcuts.find((e) => e.command === "prevChapter")?.keys || []):
                    // case i(shortcutsMapped["prevChapter"]):
                    setCurrentTab((init) => (init - 1 + maxTabLength) % maxTabLength);
                    break;
            }
        };
        window.addEventListener("keydown", keydownEvent);
        return () => {
            window.removeEventListener("keydown", keydownEvent);
        };
    }, [shortcuts]);

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

    useLayoutEffect(() => {
        // could use directly in classname but need focus()
        if (settingContRef.current) {
            settingContRef.current.scrollTop = 0;
        }
        setTimeout(() => {
            settingContRef.current?.focus();
        }, 100);
    }, [currentTab]);

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
        <FocusLock disabled={!isSettingOpen}>
            <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
                <div className="clickClose" onClick={() => dispatch(setOpenSetting(false))}></div>
                <div className="overflowWrap">
                    <div className="tabMovers">
                        <button
                            className={`tabBtn ${currentTab === TAB_INFO.settings[0] ? "selected " : ""}`}
                            onClick={() => setCurrentTab(TAB_INFO.settings[0])}
                        >
                            {TAB_INFO.settings[1]}
                        </button>
                        <button
                            className={`tabBtn ${currentTab === TAB_INFO.shortcutKeys[0] ? "selected " : ""}`}
                            onClick={() => setCurrentTab(TAB_INFO.shortcutKeys[0])}
                        >
                            {TAB_INFO.shortcutKeys[1]}
                        </button>
                        <button
                            className={`tabBtn ${currentTab === TAB_INFO.makeTheme[0] ? "selected " : ""}`}
                            onClick={() => setCurrentTab(TAB_INFO.makeTheme[0])}
                        >
                            {TAB_INFO.makeTheme[1]}
                        </button>
                        <button
                            className={`tabBtn ${currentTab === TAB_INFO.about[0] ? "selected " : ""}`}
                            onClick={() => setCurrentTab(TAB_INFO.about[0])}
                        >
                            {TAB_INFO.about[1]}
                        </button>
                        <button
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
                                                                    if (
                                                                        themeIndex > -1 &&
                                                                        allThemes[themeIndex - 1]
                                                                    ) {
                                                                        dispatch(
                                                                            setTheme(
                                                                                allThemes[themeIndex - 1].name
                                                                            )
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
                                                        (e) =>
                                                            !themesRaw.allData.map((e) => e.name).includes(e.name)
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
                                                                        dataToAdd
                                                                            .map((a) => a.name)
                                                                            .includes(e.name)
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
                                                Share Theme / Get more Themes
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
                                                                message: `Invalid theme data. Please note that data must be similar to the result of "Copy Current Theme to Clipboard"`,
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
                                                                "\u00a0".repeat(23) +
                                                                "Copied!" +
                                                                "\u00a0".repeat(23);
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
                                                            !bookmarks
                                                                .map((e) => e.data.link)
                                                                .includes(item.data.link)
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
                                        <div className="main">
                                            <InputCheckbox
                                                checked={openInSameWindow}
                                                className="noBG"
                                                onChange={(e) => {
                                                    const fileName = window.path.join(
                                                        window.electron.app.getPath("userData"),
                                                        "OPEN_IN_EXISTING_WINDOW"
                                                    );
                                                    if (!e.currentTarget.checked) {
                                                        if (window.fs.existsSync(fileName))
                                                            window.fs.rmSync(fileName);
                                                    } else {
                                                        window.fs.writeFileSync(fileName, " ");
                                                    }
                                                    setOpenInSameWindow((init) => !init);
                                                }}
                                                labelAfter="Open In Existing Window"
                                            />
                                            <code>App Restart Needed</code>
                                        </div>
                                        <ul>
                                            <li>
                                                <div className="desc">
                                                    For folders, <code>.zip/.cbz</code>, <code>.7z/.cb7</code>,{" "}
                                                    <code>.rar/.cbr</code>, <code>.pdf</code> (Opened in
                                                    Manga/Image Reader)
                                                </div>
                                                <div className="main row">
                                                    <button
                                                        onClick={() =>
                                                            window.electron.ipcRenderer.send(
                                                                "addOptionToExplorerMenu"
                                                            )
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
                                                    For <code>.epub</code>, <code>.txt</code>,{" "}
                                                    <code>.html/.xhtml</code> (Opened in Epub/Text Reader)
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
                                        NOTE: Yomikiru does not use internet for anything other than app updates if
                                        it is not linked with AniList.
                                    </div>
                                    <div className="main row">
                                        <button
                                            disabled={anilistToken ? true : false}
                                            onClick={() => {
                                                dispatch(setAniLoginOpen(true));
                                            }}
                                        >
                                            {!anilistToken
                                                ? "Login with AniList"
                                                : `Logged in as ${anilistUsername}`}
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
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.readerSettings.autoUpdateAnilistProgress}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setReaderSettings({
                                                        autoUpdateAnilistProgress: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            disabled={!anilistToken}
                                            labelAfter="Auto-Update AniList Progress"
                                        />
                                        <div className="desc">
                                            Automatically update AniList progress when chapter is read over 70%.
                                            Only works if chapter names are well formatted.
                                        </div>
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
                                                const value = e.valueAsNumber;
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
                                                            if (!(paths instanceof Array && paths.length > 0))
                                                                return;
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
                                                                    window.fs.rmSync(renderPath, {
                                                                        recursive: true,
                                                                    });
                                                                window.fs.mkdirSync(renderPath);
                                                                console.log(
                                                                    `Rendering "${path}" at "${renderPath}"`
                                                                );
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
                                            onClick={(e) => {
                                                promptSelectDir(
                                                    (path) => {
                                                        dispatch(
                                                            setAppSettings({ customStylesheet: path as string })
                                                        );
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
                                        Folder where app will extract archives or epub or render pdf. It can have
                                        big effect on extracting speed depending on type of drive (ssd, faster
                                        drives) or storage left (10GB+ recommended).
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
                                                                    .webContents.session.clearCodeCaches({
                                                                        urls: [],
                                                                    });
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
                                                dispatch(
                                                    setAppSettings({ openOnDblClick: e.currentTarget.checked })
                                                );
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
                                                dispatch(
                                                    setAppSettings({ hideOpenArrow: !e.currentTarget.checked })
                                                );
                                            }}
                                            labelAfter="Open In Reader Arrow / Button"
                                        />
                                        <div className="desc">
                                            Show the button beside items in home location list.
                                        </div>
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
                                            checked={appSettings.syncSettings}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({ syncSettings: e.currentTarget.checked })
                                                );
                                            }}
                                            labelAfter="Sync Settings"
                                        />
                                        <div className="desc">
                                            Sync app settings across all opened windows.{" "}
                                            <code>App Restart Needed</code>
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.syncThemes}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(setAppSettings({ syncThemes: e.currentTarget.checked }));
                                            }}
                                            labelAfter="Sync Themes"
                                        />
                                        <div className="desc">
                                            Sync themes across all opened windows. <code>App Restart Needed</code>
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
                                            Mark opened chapters as read. If chapter is already read, it will
                                            appear with different color in Reader's Side list and Home Locations
                                            tab.
                                        </div>
                                    </div>
                                    <div className="toggleItem" id="settings-openDirectlyFromManga">
                                        <InputCheckbox
                                            checked={appSettings.openDirectlyFromManga}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({
                                                        openDirectlyFromManga: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="Chapter Opening Shortcut"
                                        />
                                        <div className="desc">
                                            Open chapter directly by clicking name instead of arrow in reader if
                                            chapter folder is in manga folder inside default location.{" "}
                                            <a
                                                onClick={() => {
                                                    scrollIntoView(
                                                        "#settings-usage-openDirectlyFromManga",
                                                        "extras"
                                                    );
                                                }}
                                            >
                                                More Info
                                            </a>
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
                                        <div className="desc">
                                            Show search bar over bookmarks and history list.
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.openInZenMode}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({ openInZenMode: e.currentTarget.checked })
                                                );
                                            }}
                                            labelAfter="Auto Zen Mode"
                                        />
                                        <div className="desc">
                                            Open reader in "Zen Mode" by default. Applies to opening from file
                                            explorer as well.
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.hideCursorInZenMode}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({
                                                        hideCursorInZenMode: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="Zen Mode Cursor"
                                        />
                                        <div className="desc">Hide cursor in Zen Mode.</div>
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
                                            Automatically refresh reader-side-list when change in files is
                                            detected. It can be heavy task if you have slow storage and
                                            chapter+page count is high.
                                        </div>
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
                                            is set to default then there is a possibility that your system might
                                            delete those files after each power on.
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.useCanvasBasedReader}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({
                                                        useCanvasBasedReader: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="Canvas Based Rendering"
                                        />
                                        <div className="desc">
                                            Make scrolling smooth and prevent stuttering when reading high res
                                            images.
                                            <br />
                                            Drawbacks : high RAM usage and less sharp images when size is set to a
                                            low value.
                                            <code>Experimental</code>
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.readerSettings.dynamicLoading}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setReaderSettings({
                                                        dynamicLoading: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            disabled={appSettings.useCanvasBasedReader}
                                            labelAfter="Dynamic Image Loading"
                                        />
                                        <div className="desc">
                                            Removes Initial loading screen and load Images as you scroll. Doesn't
                                            work with "Canvas Based Rendering"
                                            <br />
                                            Drawbacks : Inconsistent scroll size, no double-span images support,
                                            stuttering while scrolling.
                                        </div>
                                    </div>

                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.readerSettings.focusChapterInList}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setReaderSettings({
                                                        focusChapterInList: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="Auto-Focus current chapter in side-list "
                                        />
                                        <div className="desc">
                                            Automatically focus/scroll to current chapter entry in side-list when
                                            changing chapter. Can cause huge performance loss in case of epub with
                                            large number (&gt; 500) of chapters.
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.epubReaderSettings.focusChapterInList}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setEpubReaderSettings({
                                                        focusChapterInList: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="EPUB: Auto-Focus current chapter in side-list "
                                        />
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.epubReaderSettings.loadOneChapter}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setEpubReaderSettings({
                                                        loadOneChapter: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="EPUB: Load By Chapter"
                                        />
                                        <div className="desc">
                                            Load and show one chapter at a time (from TOC). If disabled whole epub
                                            file will be displayed (high RAM usage).
                                            <br />
                                            Drawback : Content outside of TOC will not be accessible.
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={!appSettings.epubReaderSettings.textSelect}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setEpubReaderSettings({ textSelect: !e.currentTarget.checked })
                                                );
                                            }}
                                            labelAfter="EPUB: Disable Text Select / Enable double-click zen mode"
                                        />
                                        <div className="desc">
                                            Removes ability to select text in epub reader and enabled double-click
                                            zen mode.
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

                                <div className="settingItem2 otherSettings">
                                    <h3>Style Settings</h3>

                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={!appSettings.disableListNumbering}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({
                                                        disableListNumbering: !e.currentTarget.checked,
                                                    })
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
                                            Show the chapter transition screen that show up at start and end of
                                            chapter (only in vertical scroll Reading mode).
                                        </div>
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
                                            Show more info such as "date", "total pages", "last page number",
                                            "path" when mouse over items in bookmark / history tab.
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
                                        <div className="desc">
                                            Show checkbox instead of toggle in reader settings.
                                        </div>
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.showPageCountInSideList}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({
                                                        showPageCountInSideList: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="Show Page Count in Side-List"
                                        />
                                    </div>
                                    <div className="toggleItem">
                                        <InputCheckbox
                                            checked={appSettings.showTextFileBadge}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({
                                                        showTextFileBadge: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                            labelAfter="Show text files badge in Side-List"
                                        />
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
                                                        if (res && res.response === 0)
                                                            dispatch(deleteAllHistory());
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
                            <Shortcuts scrollIntoView={scrollIntoView} />
                        </div>
                        <div className={`tab ${currentTab === TAB_INFO.makeTheme[0] ? "selected " : ""}`}>
                            <ThemeCont />
                        </div>
                        <div className={`tab ${currentTab === TAB_INFO.about[0] ? "selected " : ""}`}>
                            <div className="content2">
                                <div className="settingItem2">
                                    <h3>Version</h3>
                                    <div
                                        className="desc"
                                        style={{
                                            userSelect: "text",
                                        }}
                                    >
                                        {window.electron.app.getVersion()}
                                        {" | "}
                                        {process.arch === "x64" ? "64-bit" : "32-bit"}
                                    </div>
                                    <div className="main col">
                                        <InputCheckbox
                                            className="noBG"
                                            paraAfter="Check for updates every 1 hour"
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
                                                dispatch(
                                                    setAppSettings({ skipMinorUpdate: e.currentTarget.checked })
                                                );
                                            }}
                                            title="Mostly just frequent updates rather than minor."
                                            paraAfter="Skip minor updates"
                                        />
                                        <InputCheckbox
                                            checked={appSettings.autoDownloadUpdate}
                                            className="noBG"
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({ autoDownloadUpdate: e.currentTarget.checked })
                                                );
                                            }}
                                            paraAfter="Auto download updates"
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
                                            onClick={() =>
                                                window.electron.shell.openExternal(
                                                    "https://github.com/mienaiyami/yomikiru/issues"
                                                )
                                            }
                                        >
                                            <FontAwesomeIcon icon={faGithub} /> Submit Issue, Feature Request, Ask
                                            Question
                                        </button>
                                        <button
                                            onClick={() =>
                                                window.electron.shell.openExternal(
                                                    "https://github.com/sponsors/mienaiyami"
                                                )
                                            }
                                            style={{
                                                gap: "4px",
                                            }}
                                        >
                                            <FontAwesomeIcon icon={faHeart} />
                                            Support
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
                            <Usage scrollIntoView={scrollIntoView} />
                        </div>
                    </div>
                </div>
            </div>
        </FocusLock>
    );
};

export default Settings;
