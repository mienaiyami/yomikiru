import { AppContext } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { faLink, faPlus, faTimes, faTrash, faUnlink } from "@fortawesome/free-solid-svg-icons";

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
    const [mouseOnInput, setMouseOnInput] = useState(false);
    useEffect(() => {
        if (isSettingOpen) {
            setTimeout(() => {
                settingContRef.current?.focus();
            }, 300);
        }
    }, [isSettingOpen]);

    const reservedKeys = ["h", "Control", "Tab", "Shift", "Alt", "Escape"];
    const randomString = (length: number) => {
        let result = "";
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i <= length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };
    const saveTheme = () => {
        let name = "";
        if (
            themeNameInputRef.current!.value === "" ||
            allThemes.map((e) => e.name).includes(themeNameInputRef.current!.value)
        ) {
            name = randomString(6);
        } else name = themeNameInputRef.current!.value;
        const props: ThemeDataMain[] = [...themeMakerRef.current!.getElementsByClassName("newThemeMakerProp")].map(
            (e) => (e as HTMLElement).innerText as ThemeDataMain
        );
        themeNameInputRef.current!.value = randomString(6);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-ignore
        const newThemeData: { [e in ThemeDataMain]: string } = {};
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
        setAllThemes((init) => {
            init.push({ name: name, main: newThemeData });
            return [...init];
        });
        setTheme(name);
        //! save theme on pc after adding to allThemes
        //! make ability to delete and edit themes
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
                    console.warn(e.key + " is reserved key.");
                    e.currentTarget.focus();
                    return;
                }
                settingContRef.current?.focus();
                if (e.key === "Backspace") {
                    console.log(`Deleting shortcut ${shortcuts[i].command}.${which}`);
                    setShortcuts((init) => {
                        init[i][which] = "";
                        return [...init];
                    });
                    return;
                }
                const dupIndex = shortcuts.findIndex((elem) => elem.key1 === e.key || elem.key2 === e.key);
                if (dupIndex >= 0) {
                    console.warn(`${e.key} key already bind to "${shortcuts[dupIndex].name}"`);
                    window.dialog.warn({ message: `${e.key} key already bind to "${shortcuts[dupIndex].name}".` });
                    return;
                }
                console.log(`Setting shortcut ${shortcuts[i].command}.${which} to ${e.key}`);
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
        const [rawColor, setRawColor] = useState(color.substring(0, 7));
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
                            //! remove mouseOnInput from whole file
                            // onMouseEnter={() => setMouseOnInput(true)}
                            // onMouseLeave={() => setMouseOnInput(false)}
                            min={0}
                            max={100}
                            value={Math.ceil(opacity) || 100}
                            title="Opacity"
                            // className="newThemeMakerOpacity"
                            onChange={(e) => {
                                setOpacity(() => {
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
                        <div className="name">Default Location:</div>
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
                        <div className="name">History Limit:</div>
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
                                // onMouseEnter={() => setMouseOnInput(true)}
                                // onMouseLeave={() => setMouseOnInput(false)}
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
                        <div className="name">Bookmarks:</div>
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
                                    const data: ListItem[] = JSON.parse(window.fs.readFileSync(opt[0], "utf8"));
                                    const dataToAdd: ListItem[] = [];
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
                                    const confirm1 = window.electron.dialog.showMessageBoxSync(
                                        window.electron.getCurrentWindow(),
                                        {
                                            type: "warning",
                                            title: "Delete BookMarks",
                                            message: "are you sure you want to remove bookmark?",
                                            buttons: ["yes", "no"],
                                        }
                                    );
                                    if (confirm1 == undefined) return;
                                    if (confirm1 === 1) return;
                                    if (confirm1 === 0) {
                                        const confirm2 = window.electron.dialog.showMessageBoxSync(
                                            window.electron.getCurrentWindow(),
                                            {
                                                type: "warning",
                                                title: "Delete BookMarks",
                                                message:
                                                    "are you really sure you want to remove bookmark?\nThis process is irreversible.",
                                                buttons: ["yes", "no"],
                                            }
                                        );
                                        if (confirm2 === 1) return;
                                    }
                                    setBookmarks([]);
                                }}
                            >
                                Delete All Bookmarks
                            </button>
                        </div>
                    </div>
                    <div className="settingItem themeSelector">
                        <div className="name">Theme:</div>
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
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">File Explorer Option :</div>
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
                        <div className="name">Check for Update :</div>
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
                        <div className="name">Version:</div>
                        <div className="current">
                            <span>{window.electron.app.getVersion()}</span>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div className="name">Issues/Feature Request :</div>
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
                        <div className="name">Author :</div>
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
                        <div className="name">Logs :</div>
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
                            you can make custom theme by editing themes.json. Or click ctrl+shift+i, then from the
                            styles panel change colors element.style, then copy inside {`{}`}, then open
                            themes.json, go to the end and before ] add ",{`{name:name,main:your-copied-thing}`}".
                        </li>
                        <li>you dont need to type whole word in search(e.g. for "One piece" type "op").</li>
                        <li>
                            you can open next/prev chapter in "infinite scrolling" mode by clicking on right/left
                            part of screen or a/d(Keys) when on scroll 0 or 100%.
                        </li>
                        <li>you can bring side list by moving mouse to left of screen.</li>
                        <li>you can pin and resize of side list.</li>
                        <li>you can shrink home page tabs by clicking dividers.</li>
                        <li>
                            you can open chapter directly from file explorer on right clicking folder after
                            enabling "File Explorer Option" (Note that this only opens chapter containing images
                            and not Manga Folder).
                        </li>
                        <li>Zen Mode: hide ui and only show images.</li>
                    </ul>
                </div>
                <h1>Shortcut Keys</h1>
                <div className="shortcutKey">
                    <p>
                        BackSpace to remove. Reserved keys {reservedKeys.join(", ")}. Changes apply on
                        refresh(click home icon, h(twice) or ctrl+r).
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
                                <td>size</td>
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
                        </tbody>
                    </table>
                </div>
                <h1>
                    Make Theme
                    <input
                        type="text"
                        defaultValue={randomString(6)}
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
                                <th>Color/Opacity</th>
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
