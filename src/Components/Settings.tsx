import { AppContext, themesMain } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useRef, useState } from "react";
import useTheme from "../hooks/useTheme";
import { faTimes } from "@fortawesome/free-solid-svg-icons";

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
        shortcuts,
        setShortcuts,
        promptSetDefaultLocation,
    } = useContext(AppContext);
    const settingContRef = useRef<HTMLDivElement>(null);
    const historyBtnRef = useRef<HTMLButtonElement>(null);
    const historyInputRef = useRef<HTMLInputElement>(null);
    const [mouseOnInput, setMouseOnInput] = useState(false);
    useEffect(() => {
        if (isSettingOpen) {
            setTimeout(() => {
                settingContRef.current?.focus();
            }, 300);
        }
    }, [isSettingOpen]);

    const reservedKeys = ["h", "Control", "Tab", "Shift", "Alt", "Escape"];
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

    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div className="clickClose" onClick={() => setSettingOpen(false)}></div>
            <div
                className="cont"
                style={{ overflow: mouseOnInput ? "hidden" : "auto" }}
                onKeyDown={(e) => {
                    if (e.key === "Escape") setSettingOpen(false);
                }}
                tabIndex={-1}
                ref={settingContRef}
            >
                <h1>
                    Settings
                    <button onClick={() => setSettingOpen(false)}>
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
                                onMouseEnter={() => setMouseOnInput(true)}
                                onMouseLeave={() => setMouseOnInput(false)}
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
                                onClick={(e) => {
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
                            <p>
                                Add custom theme by adding new item with changed css variable in <br />
                                <span className="copy">
                                    {window.path.join(window.electron.app.getPath("userData"), "themes.json")}
                                </span>
                            </p>
                            {themesMain.map((e) => (
                                <button
                                    className={theme === e.name ? "selected" : ""}
                                    onClick={() => setTheme(e.name)}
                                    key={e.name}
                                >
                                    {e.name}
                                </button>
                            ))}
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
                        </div>
                    </div>
                </div>
                <h1>Features</h1>
                <div className="features">
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
                            {/* <tr>
                                <td>size</td>
                                <td> - , =, +, ctrl+scroll</td>
                            </tr>
                            <tr>
                                <td>Zen Mode</td>
                                <td> `</td>
                            </tr>
                            <tr>
                                <td>reader settings</td>
                                <td>q</td>
                            </tr>
                            <tr>
                                <td>scroll</td>
                                <td>w, s, ↑, ↓</td>
                            </tr>
                            <tr>
                                <td>prev/next page</td>
                                <td>a, d, ←, → </td>
                            </tr>
                            <tr>
                                <td>large scroll</td>
                                <td>space/shift+space</td>
                            </tr>
                            <tr>
                                <td>search page number</td>
                                <td>f</td>
                            </tr>
                            <tr>
                                <td>prev/next</td>
                                <td>[ and ]</td>
                            </tr> */}
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
            </div>
        </div>
    );
};

export default Settings;
