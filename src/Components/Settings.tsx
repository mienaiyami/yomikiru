import { AppContext } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useRef, useState } from "react";

const Settings = ({ promptSetDefaultLocation }: { promptSetDefaultLocation: () => void }): ReactElement => {
    const historyBtnRef = useRef<HTMLButtonElement>(null);
    const historyInputRef = useRef<HTMLInputElement>(null);
    const { isSettingOpen, setSettingOpen, appSettings, setAppSettings, bookmarks, setBookmarks } =
        useContext(AppContext);
    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div className="clickClose" onClick={() => setSettingOpen(false)}></div>
            <div className="cont">
                <h1>Settings</h1>
                <div className="content">
                    <div className="settingItem defaultLocation">
                        <div className="name">Default Location:</div>
                        <div className="current">
                            <input type="text" value={appSettings.baseDir} readOnly />
                            <button
                                onClick={() => {
                                    promptSetDefaultLocation();
                                }}>
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
                                onKeyDown={e => {
                                    if (e.key === "Enter") {
                                        historyBtnRef.current?.click();
                                    }
                                }}
                                readOnly={true}
                            />
                            <button
                                data-type="enable"
                                ref={historyBtnRef}
                                onClick={e => {
                                    if (e.currentTarget.getAttribute("data-type") === "enable") {
                                        historyInputRef.current?.removeAttribute("readonly");
                                        historyInputRef.current?.focus();
                                        e.currentTarget.textContent = "Confirm";
                                        e.currentTarget.setAttribute("data-type", "set");
                                        e.currentTarget.classList.add("enabled");
                                    } else if (e.currentTarget.getAttribute("data-type") === "set") {
                                        setAppSettings(init => {
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
                                }}>
                                Change Default
                            </button>
                        </div>
                    </div>
                    <div className="settingItem exportBookmark">
                        <div className="name">Bookmarks:</div>
                        <div className="current">
                            <button
                                onClick={e => {
                                    const opt = window.electron.dialog.showSaveDialogSync({
                                        title: "Export Bookmarks",
                                        filters: [
                                            {
                                                name: "Json",
                                                extensions: ["json"],
                                            },
                                        ],
                                    });
                                    if (opt == undefined) return;
                                    window.fs.writeFileSync(opt, JSON.stringify(bookmarks) || JSON.stringify([]));
                                }}>
                                Export
                            </button>
                            <button
                                onClick={() => {
                                    const opt = window.electron.dialog.showOpenDialogSync({
                                        properties: ["openFile"],
                                        filters: [
                                            {
                                                name: "Json",
                                                extensions: ["json"],
                                            },
                                        ],
                                    });
                                    if (opt == undefined) return;
                                    const data: string[] = JSON.parse(window.fs.readFileSync(opt[0], "utf8"));
                                    const dataToAdd: string[] = [];
                                    // let similarFound = 0;
                                    // data.forEach((item) => {
                                    //     if (!bookmarks.map((e) => e.link).includes(item.link)) {
                                    //         dataToAdd.push(item);
                                    //     } else{
                                    //         similarFound++;
                                    //     }
                                    // })
                                    // if(similarFound>0) window.electron.dialog.showMessageBoxSync({
                                    //     type: 'warning',
                                    //     message: 'Found '+ similarFound+ ' similar',
                                    //     buttons: ['Ok'],
                                    // });
                                    // setBookmarks([...bookmarks,...dataToAdd])
                                }}>
                                Import
                            </button>
                            <button
                                onClick={() => {
                                    const confirm1 = window.electron.dialog.showMessageBoxSync(
                                        window.electron.BrowserWindow.getFocusedWindow() ||
                                            window.electron.BrowserWindow.getAllWindows()[0],
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
                                            window.electron.BrowserWindow.getFocusedWindow() ||
                                                window.electron.BrowserWindow.getAllWindows()[0],
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
                                }}>
                                Delete All Bookmarks
                            </button>
                        </div>
                    </div>
                    <div className="settingItem historyLimit">
                        <div className="name">Theme:</div>
                        <div className="current">Coming Soon</div>
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
                                className="postIssue"
                                onClick={() =>
                                    window.electron.shell.openExternal(
                                        "https://github.com/mienaiyami/offline-manga-reader/issues"
                                    )
                                }
                                tabIndex={-1}>
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
                                <td>- and = and +</td>
                                <td>size</td>
                            </tr>
                            <tr>
                                <td>wsad and arrow keys</td>
                                <td>scroll</td>
                            </tr>
                            <tr>
                                <td>spacebar</td>
                                <td>large scroll</td>
                            </tr>
                            <tr>
                                <td>h</td>
                                <td>Home/Refresh</td>
                            </tr>
                            <tr>
                                <td>f</td>
                                <td>search page number</td>
                            </tr>
                            <tr>
                                <td>&lt; and &gt;</td>
                                <td>prev/next</td>
                            </tr>
                            <tr>
                                <td>Enter or /</td>
                                <td>focus input box(home page only)</td>
                            </tr>
                            <tr>
                                <td>ctrl + s</td>
                                <td>settings</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Settings;
