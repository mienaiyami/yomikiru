import { AppContext, themesMain } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useRef, useState } from "react";
import useTheme from "../hooks/useTheme";

const Settings = ({ promptSetDefaultLocation }: { promptSetDefaultLocation: () => void }): ReactElement => {
    const {
        isSettingOpen,
        setSettingOpen,
        appSettings,
        setAppSettings,
        bookmarks,
        setBookmarks,
        theme,
        setTheme,
    } = useContext(AppContext);
    const historyBtnRef = useRef<HTMLButtonElement>(null);
    const historyInputRef = useRef<HTMLInputElement>(null);
    const [mouseOnInput, setMouseOnInput] = useState(false);
    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div className="clickClose" onClick={() => setSettingOpen(false)}></div>
            <div className="cont" style={{ overflow: mouseOnInput ? "hidden" : "auto" }}>
                <h1>Settings</h1>
                <div className="content">
                    <div className="settingItem defaultLocation">
                        <div className="name">Default Location:</div>
                        <div className="current">
                            <input type="text" value={appSettings.baseDir} readOnly />
                            <button
                                onFocus={(e) => e.currentTarget.blur()}
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
                                onFocus={(e) => e.currentTarget.blur()}
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
                                onFocus={(e) => e.currentTarget.blur()}
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
                                onFocus={(e) => e.currentTarget.blur()}
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
                                        window.electron.dialog.showMessageBox({
                                            type: "warning",
                                            title: "warning",
                                            message: "Found " + similarFound + " with same link",
                                            buttons: ["Ok"],
                                        });
                                    setBookmarks([...bookmarks, ...dataToAdd]);
                                }}
                            >
                                Import
                            </button>
                            <button
                                onFocus={(e) => e.currentTarget.blur()}
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
                    <div className="settingItem version">
                        <div className="name">Version:</div>
                        <div className="current">
                            <span>{window.electron.app.getVersion()}</span>
                        </div>
                    </div>
                    <div className="settingItem issue">
                        <div className="name">Issues? :</div>
                        <div className="current">
                            <button
                                onFocus={(e) => e.currentTarget.blur()}
                                className="postIssue"
                                onClick={() =>
                                    window.electron.shell.openExternal(
                                        "https://github.com/mienaiyami/react-ts-offline-manga-reader/issue"
                                    )
                                }
                                tabIndex={-1}
                            >
                                <FontAwesomeIcon icon={faGithub} /> Submit Issue
                            </button>
                        </div>
                    </div>
                </div>
                <h1>Shortcut Keys</h1>
                <div className="shortcutKey">
                    <table>
                        <tbody>
                            <tr>
                                <th>Key</th>
                                <th>Function</th>
                            </tr>
                            <tr>
                                <td> - and = and +</td>
                                <td>size</td>
                            </tr>
                            <tr>
                                <td>wsad and arrow keys</td>
                                <td>scroll</td>
                            </tr>
                            <tr>
                                <td>space/shift+space</td>
                                <td>large scroll</td>
                            </tr>
                            <tr>
                                <td>h</td>
                                <td>Home</td>
                            </tr>
                            <tr>
                                <td>ctrl r</td>
                                <td>Reload</td>
                            </tr>
                            <tr>
                                <td>f</td>
                                <td>search page number</td>
                            </tr>
                            <tr>
                                <td>[ and ]</td>
                                <td>prev/next</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Settings;
