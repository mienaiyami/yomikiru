import { AppContext } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useRef, useState } from "react";

const Settings = ({
    promptSetDefaultLocation,
}: {
    promptSetDefaultLocation: () => void;
}): ReactElement => {
    const historyBtnRef = useRef<HTMLButtonElement>(null);
    const {
        isSettingOpen,
        setSettingOpen,
        appSettings,
        bookmarks,
        setBookmarks,
        history,
    } = useContext(AppContext);
    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div
                className="clickClose"
                onClick={() => setSettingOpen(false)}
            ></div>
            <div className="cont">
                <h1>Settings</h1>
                <div className="content">
                    <div className="settingItem defaultLocation">
                        <div className="name">Default Location:</div>
                        <div className="current">
                            <input
                                type="text"
                                value={appSettings.baseDir}
                                readOnly
                            />
                            <button
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
                                value={appSettings.historyLimit}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        historyBtnRef.current?.click();
                                    }
                                }}
                                readOnly
                            />
                            <button
                                data-type="enable"
                                ref={historyBtnRef}
                                onClick={() => {
                                    // if($(this).attr('data-type')==='enable'){
                                    //     $(this).attr('data-type','set')
                                    //     $(this).addClass('enabled');
                                    //     $(this).html('Set New')
                                    //     $(this).siblings('input').removeAttr('disabled');
                                    //     $(this).siblings('input').trigger('focus').trigger('select')
                                    //     return;
                                    // }if($(this).attr('data-type')==='set'){
                                    //     $(this).attr('data-type','enable')
                                    //     $(this).removeClass('enabled');
                                    //     $(this).html('Done')
                                    //     $(this).prop('disabled',true)
                                    //     setTimeout(()=>{
                                    //         $(this).html('Change Default')
                                    //         $(this).removeAttr('disabled')
                                    //     },3000)
                                    //     $(this).siblings('input').prop('disabled',true)
                                    //     localStorage.setItem('historyLimit',$(this).siblings('input').val())
                                    //     historyLimit = $(this).siblings('input').val()
                                    //     return;
                                    // }
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
                                onClick={(e) => {
                                    const opt =
                                        window.electron.dialog.showSaveDialogSync(
                                            {
                                                title: "Export Bookmarks",
                                                filters: [
                                                    {
                                                        name: "Json",
                                                        extensions: ["json"],
                                                    },
                                                ],
                                            }
                                        );
                                    if (opt == undefined) return;
                                    window.fs.writeFileSync(
                                        opt,
                                        JSON.stringify(bookmarks) ||
                                            JSON.stringify([])
                                    );
                                }}
                            >
                                Export
                            </button>
                            <button
                                onClick={() => {
                                    const opt =
                                        window.electron.dialog.showOpenDialogSync(
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
                                    const data: string[] = JSON.parse(
                                        window.fs.readFileSync(opt[0], "utf8")
                                    );
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
                                }}
                            >
                                Import
                            </button>
                            <button
                                onClick={() => {
                                    // let btn = $(this);
                                    // let confirm1 = dialog.showMessageBoxSync({
                                    //     type: 'warning',
                                    //     title:'Delete BookMarks',
                                    //     message: 'are you sure you want to remove bookmark?',
                                    //     buttons: ['yes', 'no'],
                                    // });
                                    // if(confirm1==undefined) return;
                                    // if(confirm1===1) return;
                                    // if(confirm1===0){
                                    //     let confirm2 = dialog.showMessageBoxSync({
                                    //         type: 'warning',
                                    //         title:'Delete BookMarks',
                                    //         message: 'are you really sure you want to remove bookmark?\\nThis process is irreversible.',
                                    //         buttons: ['yes', 'no'],
                                    //     });
                                    //     if(confirm2===1) return;
                                    // }
                                    // bookmarkPaths =[];
                                    // $('#bookmarksTab .location-cont').html('<p>No items</p>');
                                    // localStorage.setItem('bookmarkPaths', JSON.stringify(bookmarkPaths));
                                    // btn.html('Done')
                                    // btn.prop('disabled',true)
                                    // setTimeout(()=>{
                                    //     btn.html('Delete All Bookmarks')
                                    //     btn.removeAttr('disabled')
                                    // },3000)
                                }}
                            >
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
