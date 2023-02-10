import { AppContext } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { faEdit, faLink, faPlus, faSync, faTimes, faTrash, faUnlink } from "@fortawesome/free-solid-svg-icons";
import themesRaw from "../themeInit.json";

const Settings = (): ReactElement => {
    const {
        isSettingOpen,
        setSettingOpen,
        appSettings,
        setAppSettings,
        bookmarks,
        setBookmarks,
        theme,
        setTheme,
        allThemes,
        setAllThemes,
        shortcuts,
        setShortcuts,
        promptSetDefaultLocation,
    } = useContext(AppContext);
    const settingContRef = useRef<HTMLDivElement>(null);
    const historyBtnRef = useRef<HTMLButtonElement>(null);
    const historyInputRef = useRef<HTMLInputElement>(null);
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
        if (themesRaw.map((e) => e.name).includes(name)) {
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
        const newThemeData = window.themeProps;
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
            setAllThemes((init) => {
                init[init.findIndex((e) => e.name === name)].main = newThemeData;
                return [...init];
            });
            return;
        }
        setAllThemes((init) => {
            init.push({ name: name, main: newThemeData });
            return [...init];
        });
        setTheme(name);
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
                    setShortcuts((init) => {
                        init[i][which] = "";
                        return [...init];
                    });
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
                setShortcuts((init) => {
                    init[i][which] = e.key;
                    return [...init];
                });
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
            if (firstRendered) {
                // console.log(
                //     prop,
                //     rawColor.substring(0, 7) +
                //         (Math.ceil(opacity * 2.55).toString(16).length < 2
                //             ? "0" + Math.ceil(opacity * 2.55).toString(16)
                //             : Math.ceil(opacity * 2.55).toString(16))
                // );
                if (prop === "--icon-color")
                    window.electron.getCurrentWindow().setTitleBarOverlay({ symbolColor: rawColor });
                if (prop === "--topBar-color")
                    window.electron.getCurrentWindow().setTitleBarOverlay({ color: rawColor });
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
            <td>
                <button
                    className="resetBtn"
                    onClick={() => {
                        setRawColor(color);
                        setOpacity(color.length > 7 ? parseInt(color.substring(7), 16) / 2.55 : 100);
                        setRawColorWhole(color);
                    }}
                >
                    <FontAwesomeIcon icon={faSync} />
                </button>
                <label className={checked ? "selected" : ""}>
                    <input
                        type="checkbox"
                        defaultChecked={checked}
                        ref={ref}
                        onChange={() => setChecked((init) => !init)}
                    />
                    <FontAwesomeIcon icon={checked ? faUnlink : faLink} />
                </label>
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
                                setRawColor(e.target.value === "" ? "#000000" : e.target.value.substring(0, 7));
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
        );
    };

    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div className="clickClose" onClick={() => setSettingOpen(false)}></div>
            <div
                className={"cont"}
                onKeyDown={(e) => {
                    if (e.key === "Escape") setSettingOpen(false);
                }}
                tabIndex={-1}
                ref={settingContRef}
            >
                <h1>
                    Settings
                    <button onClick={() => setSettingOpen(false)} className="closeBtn">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </h1>
                <div className="content">
                    <div className="settingItem defaultLocation">
                        <div className="name">Default Location</div>
                        <div className="current">
                            <input type="text" value={appSettings.baseDir} readOnly />
                            <button
                                // onFocus={(e) => e.currentTarget.blur()}
                                onClick={() => {
                                    promptSetDefaultLocation();
                                }}
                            >
                                Change Default
                            </button>
                        </div>
                    </div>
                    <div className="settingItem historyLimit">
                        <div className="name">History Limit</div>
                        <div className="current">
                            <input
                                type="number"
                                defaultValue={appSettings.historyLimit}
                                ref={historyInputRef}
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                    if (e.key === "Enter") {
                                        historyBtnRef.current?.click();
                                    }
                                }}
                                readOnly={true}
                            />
                            <button
                                data-type="enable"
                                // onFocus={(e) => e.currentTarget.blur()}
                                ref={historyBtnRef}
                                onClick={(e) => {
                                    if (e.currentTarget.getAttribute("data-type") === "enable") {
                                        historyInputRef.current?.removeAttribute("readonly");
                                        historyInputRef.current?.focus();
                                        e.currentTarget.textContent = "Confirm";
                                        e.currentTarget.setAttribute("data-type", "set");
                                        e.currentTarget.classList.add("enabled");
                                    } else if (e.currentTarget.getAttribute("data-type") === "set") {
                                        setAppSettings((init) => {
                                            if (historyInputRef.current) {
                                                init.historyLimit = parseInt(historyInputRef.current.value);
                                            }
                                            return { ...init };
                                        });
                                        historyInputRef.current?.setAttribute("readonly", "true");
                                        e.currentTarget.textContent = "Change Default";
                                        e.currentTarget.setAttribute("data-type", "enable");
                                        e.currentTarget.classList.remove("enabled");
                                    }
                                }}
                            >
                                Change Default
                            </button>
                        </div>
                    </div>
                    <div className="settingItem exportBookmark">
                        <div className="name">Bookmarks</div>
                        <div className="current">
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
                                    window.fs.writeFileSync(opt, JSON.stringify(bookmarks) || JSON.stringify([]));
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
                                    const data: ChapterItem[] = JSON.parse(window.fs.readFileSync(opt[0], "utf8"));
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
                                    setBookmarks([...bookmarks, ...dataToAdd]);
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
                                                        setBookmarks([]);
                                                    });
                                            }
                                        });
                                }}
                            >
                                Delete All Bookmarks
                            </button>
                        </div>
                    </div>
                    <div className="settingItem themeSelector">
                        <div className="name">Theme</div>
                        <div className="current">
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
                                        onClick={() => setTheme(e.name)}
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
                                            window.dialog
                                                .confirm({ message: `Delete theme "${e.name}"`, noOption: false })
                                                .then((res) => {
                                                    if (res.response === 0) {
                                                        setAllThemes((init) => {
                                                            init.splice(i, 1);
                                                            return [...init];
                                                        });
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
                                    themeMakerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} /> / <FontAwesomeIcon icon={faEdit} />
                            </button>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">File Explorer Option </div>
                        <div className="current">
                            <button onClick={() => window.electron.ipcRenderer.send("addOptionToExplorerMenu")}>
                                Add
                            </button>
                            <button onClick={() => window.electron.ipcRenderer.send("deleteOptionInExplorerMenu")}>
                                Remove
                            </button>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">Check for Update</div>
                        <div className="current">
                            <label className={appSettings.updateCheckerEnabled ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.updateCheckerEnabled}
                                    onChange={(e) => {
                                        setAppSettings((init) => {
                                            init.updateCheckerEnabled = e.currentTarget.checked;
                                            return { ...init };
                                        });
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
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">Other Settings</div>
                        <div className="current list">
                            <label className={appSettings.askBeforeClosing ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.askBeforeClosing}
                                    onChange={(e) => {
                                        setAppSettings((init) => {
                                            init.askBeforeClosing = e.currentTarget.checked;
                                            return { ...init };
                                        });
                                    }}
                                />
                                <p>Ask before closing window? (Needs Restart).</p>
                            </label>
                            <label className={appSettings.skipMinorUpdate ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.skipMinorUpdate}
                                    onChange={(e) => {
                                        setAppSettings((init) => {
                                            init.skipMinorUpdate = e.currentTarget.checked;
                                            return { ...init };
                                        });
                                    }}
                                />
                                <p>Skip minor updates.</p>
                            </label>
                            <label className={appSettings.openDirectlyFromManga ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.openDirectlyFromManga}
                                    onChange={(e) => {
                                        setAppSettings((init) => {
                                            init.openDirectlyFromManga = e.currentTarget.checked;
                                            return { ...init };
                                        });
                                    }}
                                />
                                <p>
                                    Open chapter directly (by clicking name instead of arrow) in reader if chapter
                                    folder is in manga folder inside "default location".
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
                                        setAppSettings((init) => {
                                            init.readerSettings.disableChapterTransitionScreen =
                                                e.currentTarget.checked;
                                            return { ...init };
                                        });
                                    }}
                                />
                                <p>
                                    Disable the screen that appears at start or end of chapters (only in "infinite
                                    scroll" reader mode when "zen mode" is not on)
                                </p>
                            </label>
                        </div>
                    </div>
                    {/* <div className="settingItem version">
                        <div className="name">Others:</div>
                        <div className="current">
                            <label>
                                <input type="checkbox" />
                                <p>Show Loading Screen</p>
                            </label>
                        </div>
                    </div> */}
                </div>
                <h1>About</h1>
                <div className="content">
                    <div className="settingItem">
                        <div className="name">Version </div>
                        <div className="current">
                            <span>{window.electron.app.getVersion()}</span>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">Home</div>
                        <div className="current">
                            <button
                                onClick={() =>
                                    window.electron.shell.openExternal(
                                        "https://github.com/mienaiyami/react-ts-offline-manga-reader/"
                                    )
                                }
                            >
                                <FontAwesomeIcon icon={faGithub} /> Home Page
                            </button>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">Issues/Feature Request</div>
                        <div className="current">
                            <button
                                // onFocus={(e) => e.currentTarget.blur()}
                                onClick={() =>
                                    window.electron.shell.openExternal(
                                        "https://github.com/mienaiyami/react-ts-offline-manga-reader/issues"
                                    )
                                }
                            >
                                <FontAwesomeIcon icon={faGithub} /> Submit Issue
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
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">Author</div>
                        <div className="current">
                            <button
                                onClick={() =>
                                    window.electron.shell.openExternal("https://github.com/mienaiyami/")
                                }
                            >
                                <FontAwesomeIcon icon={faGithub} /> MienaiYami
                            </button>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">Logs</div>
                        <div className="current">
                            <button
                                onClick={() =>
                                    window.electron.shell.showItemInFolder(
                                        window.path.join(window.electron.app.getPath("userData"), "logs/main.log")
                                    )
                                }
                            >
                                Open Logs
                            </button>
                            <button
                                onClick={() =>
                                    window.electron.shell.openExternal(
                                        "https://github.com/mienaiyami/react-ts-offline-manga-reader/releases"
                                    )
                                }
                            >
                                Changelogs
                            </button>
                        </div>
                    </div>
                </div>
                <h1>Features</h1>
                <div className="content features">
                    <ul>
                        <li>
                            Collapse/Un-collapse Bookmarks, History page tabs by clicking on the Dividers beside
                            them in home screen.
                        </li>
                        <li>You don't need to type the whole word in search. (e.g. For "One Piece" type "op").</li>
                        <li>
                            In Infinite Scroll, on First/Last page, go to Previous/Next chapter by clicking on the
                            Left/Right part of the screen respectively
                        </li>
                        <li>
                            Access the side list by moving the mouse to left side of the screen. You can pin and
                            resize the side list.
                        </li>
                        <li>
                            Open chapter directly from the file explorer after enabling 'File Explorer Option'.
                            (Right Click on folder {"->"} Show more options {"->"} Open in Manga Reader) Note that
                            this only opens the chapter containing images, not the Manga Folder.
                        </li>
                        <li>Zen Mode: Hides UI, Only shows images. (Full Screen)</li>
                        <li>
                            Open link from home location list when it is in a directory which is in set default
                            location. e.g. if default location is "D:\manga\" and there is folder named "One Piece"
                            in it, then any folder which is directly under "One Piece" will open directly by
                            clicking link itself instead of clicking arrow icon beside it. (Can be enabled from
                            settings.);
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
                                        setShortcuts(window.shortcutsFunctions);
                                    }
                                });
                        }}
                    >
                        <FontAwesomeIcon icon={faSync} />
                    </button>
                </h1>
                <div className="shortcutKey">
                    <p>
                        <li>Backspace to delete Key.</li>
                        <li>Reserved Keys : {reservedKeys.join(", ")}.</li>
                    </p>
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
                                <td>ctrl+n</td>
                            </tr>
                            <tr>
                                <td>Reader width</td>
                                <td>ctrl+scroll</td>
                            </tr>
                            <tr>
                                <td>Home</td>
                                <td>h</td>
                            </tr>
                            <tr>
                                <td>Reload</td>
                                <td>ctrl+r</td>
                            </tr>
                            <tr>
                                <td>Dev Tool</td>
                                <td>ctrl+shift+i</td>
                            </tr>
                            <tr>
                                <td>UI Scale(Only works)</td>
                                <td>"ctrl" + "-"(scale down) / "ctrl" + "="(scale up) / ctrl + 0(reset)</td>
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
                    <p>
                        To use previously defined color, click on link button then type example "var(--body-bg)" in
                        input box. Or you can type hex color in it as well (#RRGGBBAA).
                        <br />
                        If you want to edit existing theme, click on theme then click on plus icon then change
                        theme according to your liking.
                    </p>
                    <table>
                        <tbody>
                            <tr>
                                <th>Property</th>
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
