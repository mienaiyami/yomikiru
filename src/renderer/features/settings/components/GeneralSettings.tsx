import { makeNewSettings, setAppSettings, setEpubReaderSettings, setReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { resetAllTheme } from "@store/themes";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { useEffect, useState } from "react";
import FileExplorerOptions from "./FileExplorerOptions";
import InputCheckbox from "@ui/InputCheckbox";
import { resetShortcuts } from "@store/shortcuts";
import { useSettingsContext } from "../Settings";
import AnilistSetting from "./AnilistSetting";
import CustomTempLocation from "./CustomTempLocation";
import GeneralThemeSettings from "./GeneralThemeSettings";
import GeneralPDFSettings from "./GeneralPDFSettings";
import { resetLibrary } from "@store/library";

const GeneralSettings: React.FC = () => {
    const { scrollIntoView } = useSettingsContext();
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();

    const [mainSettings, setMainSettings] = useState<{ hardwareAcceleration: boolean; askBeforeClosing: boolean }>(
        {
            hardwareAcceleration: true,
            askBeforeClosing: false,
        },
    );

    useEffect(() => {
        window.electron.invoke("mainSettings:get").then((settings) => {
            setMainSettings({
                hardwareAcceleration: settings.hardwareAcceleration,
                askBeforeClosing: settings.askBeforeClosing,
            });
        });
    }, []);

    return (
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
                            promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path as string })));
                        }}
                    >
                        Change Default
                    </button>
                </div>
            </div>
            <GeneralThemeSettings />
            <div className="settingItem2">
                <h3>Bookmarks</h3>
                <div className="main row">
                    <button
                        onClick={() => {
                            throw new Error("Not implemented");
                            // if (bookmarks === 0) {
                            //     dialogUtils.customError({
                            //         message: "No bookmarks detected.",
                            //         log: false,
                            //     });
                            //     return;
                            // }
                            // const opt = window.electron.dialog.showSaveDialogSync(
                            //     window.electron.getCurrentWindow(),
                            //     {
                            //         title: "Export Bookmarks",
                            //         defaultPath: "yomikiru-bookmarks.json",
                            //         filters: [
                            //             {
                            //                 name: "json",
                            //                 extensions: ["json"],
                            //             },
                            //         ],
                            //     }
                            // );
                            // if (opt == undefined) return;
                            // window.fs.writeFileSync(
                            //     opt,
                            //     JSON.stringify(bookmarks, null, "\t") || JSON.stringify([])
                            // );
                        }}
                    >
                        Export
                    </button>
                    <button
                        onClick={() => {
                            throw new Error("Not implemented");
                            // const opt = window.electron.dialog.showOpenDialogSync(
                            //     window.electron.getCurrentWindow(),
                            //     {
                            //         properties: ["openFile"],
                            //         filters: [
                            //             {
                            //                 name: "Json",
                            //                 extensions: ["json"],
                            //             },
                            //         ],
                            //     }
                            // );
                            // if (opt == undefined) return;
                            // const data: Manga_BookItem[] = JSON.parse(
                            //     window.fs.readFileSync(opt[0], "utf8")
                            // );
                            // const dataToAdd: Manga_BookItem[] = [];
                            // let similarFound = 0;
                            // let importedCount = 0;
                            // if (!(data instanceof Array)) {
                            //     dialogUtils.customError({
                            //         message:
                            //             "Data is not in correct format. To make sure it is correct, compare it with existing bookmark.json and fix.",
                            //         log: false,
                            //     });
                            //     return;
                            // }
                            // data.forEach((item) => {
                            //     if ("type" in item && "data" in item) {
                            //         if (
                            //             !bookmarks
                            //                 .map((e) => e.data.link)
                            //                 .includes(item.data.link)
                            //         ) {
                            //             dataToAdd.push(item);
                            //             importedCount++;
                            //         } else {
                            //             similarFound++;
                            //         }
                            //     }
                            // });
                            // if (similarFound > 0)
                            //     dialogUtils.warn({
                            //         title: "warning",
                            //         message: "Found " + similarFound + " with same link",
                            //     });
                            // dialogUtils.confirm({
                            //     title: "Imported",
                            //     message: "Imported " + importedCount + " bookmarks.",
                            //     noOption: true,
                            // });
                            // dispatch(addBookmark(dataToAdd));
                        }}
                    >
                        Import
                    </button>
                    <button
                        onClick={() => {
                            throw new Error("Not implemented");
                            // dialogUtils
                            //     .warn({
                            //         title: "Delete BookMarks",
                            //         message: "Are you sure you want to clear bookmarks?",
                            //         noOption: false,
                            //     })
                            //     .then(({ response }) => {
                            //         if (response == undefined) return;
                            //         if (response === 1) return;
                            //         if (response === 0) {
                            //             dialogUtils
                            //                 .warn({
                            //                     title: "Delete Bookmarks",
                            //                     noOption: false,
                            //                     message:
                            //                         "Are you really sure you want to clear bookmarks?\nThis process is irreversible.",
                            //                 })
                            //                 .then((res) => {
                            //                     if (res.response === 1) return;
                            //                     dispatch(removeAllBookmarks());
                            //                 });
                            //         }
                            //     });
                        }}
                    >
                        Delete All Bookmarks
                    </button>
                </div>
            </div>
            {process.platform === "win32" && <FileExplorerOptions />}
            <AnilistSetting />
            <GeneralPDFSettings />
            <div className="settingItem2" id="settings-customStylesheet">
                <h3>Custom Stylesheet</h3>
                <div className="desc">
                    You can include your custom css stylesheet to change style of app more than what theme can do.{" "}
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
                        onClick={() => {
                            promptSelectDir(
                                (path) => {
                                    dispatch(setAppSettings({ customStylesheet: path as string }));
                                },
                                true,
                                [
                                    {
                                        extensions: ["css"],
                                        name: "Cascading Style Sheets",
                                    },
                                ],
                            );
                        }}
                    >
                        Select
                    </button>
                    <button
                        onClick={() => {
                            dispatch(setAppSettings({ customStylesheet: "" }));
                        }}
                    >
                        Clear
                    </button>
                </div>
            </div>
            <CustomTempLocation />
            <div className="settingItem2 otherSettings">
                <h3>Other Settings</h3>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={mainSettings.hardwareAcceleration}
                        className="noBG"
                        onChange={async (e) => {
                            await window.electron
                                .invoke("mainSettings:update", {
                                    hardwareAcceleration: e.currentTarget.checked,
                                })
                                .then(setMainSettings);
                        }}
                        labelAfter="Hardware Acceleration"
                    />
                    <div className="desc">
                        Use GPU to accelerate rendering. Prevents reader stuttering.{" "}
                        <code>App Restart Needed</code>
                    </div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={mainSettings.askBeforeClosing}
                        className="noBG"
                        onChange={async (e) => {
                            await window.electron
                                .invoke("mainSettings:update", {
                                    askBeforeClosing: e.currentTarget.checked,
                                })
                                .then(setMainSettings);
                        }}
                        labelAfter="Confirm Close Window"
                    />
                    <div className="desc">Ask for confirmation before closing a window.</div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={appSettings.openOnDblClick}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(setAppSettings({ openOnDblClick: e.currentTarget.checked }));
                        }}
                        labelAfter="Open on double-click"
                    />
                    <div className="desc">Open items from home location list in reader on double click.</div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={appSettings.syncSettings}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(setAppSettings({ syncSettings: e.currentTarget.checked }));
                        }}
                        labelAfter="Sync Settings"
                    />
                    <div className="desc">
                        Sync app settings across all opened windows. <code>App Restart Needed</code>
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
                <div className="toggleItem" id="settings-openDirectlyFromManga">
                    <InputCheckbox
                        checked={appSettings.openDirectlyFromManga}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                setAppSettings({
                                    openDirectlyFromManga: e.currentTarget.checked,
                                }),
                            );
                        }}
                        labelAfter="Chapter Opening Shortcut"
                    />
                    <div className="desc">
                        Open chapter directly by clicking name instead of arrow in reader if chapter folder is in
                        manga folder inside default location.{" "}
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
                        checked={appSettings.confirmDeleteItem}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                setAppSettings({
                                    confirmDeleteItem: e.currentTarget.checked,
                                }),
                            );
                        }}
                        labelAfter="Confirm Side-List Item Delete"
                    />
                    <div className="desc">
                        Confirm before deleting item from history/bookmark/note in side list.
                        <br />
                        Always true on home page.
                    </div>
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
                        Open reader in &quot;Zen Mode&quot; by default. Applies to opening from file explorer as
                        well.
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
                                }),
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
                                }),
                            );
                        }}
                        labelAfter="Auto Refresh Side-list"
                    />
                    <div className="desc">
                        Automatically refresh reader-side-list when change in files is detected. It can be heavy
                        task if you have slow storage and chapter+page count is high.
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
                                }),
                            );
                        }}
                        labelAfter="Canvas Based Rendering"
                    />
                    <div className="desc">
                        Make scrolling smooth and prevent stuttering when reading high res images.
                        <br />
                        Drawbacks : high RAM usage and less sharp images when size is set to a low value.
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
                                }),
                            );
                        }}
                        disabled={appSettings.useCanvasBasedReader}
                        labelAfter="Dynamic Image Loading"
                    />
                    <div className="desc">
                        Removes Initial loading screen and load Images as you scroll. Doesn&apos;t work with
                        &quot;Canvas Based Rendering&quot;
                        <br />
                        Drawbacks : Inconsistent scroll size, no double-span images support, stuttering while
                        scrolling.
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
                                }),
                            );
                        }}
                        labelAfter="Auto-Focus current chapter in side-list "
                    />
                    <div className="desc">
                        Automatically focus/scroll to current chapter entry in side-list when changing chapter. Can
                        cause huge performance loss in case of epub with large number (&gt; 500) of chapters.
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
                                }),
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
                                }),
                            );
                        }}
                        labelAfter="EPUB: Load By Chapter"
                    />
                    <div className="desc">
                        Load and show one chapter at a time (from TOC). If disabled whole epub file will be
                        displayed (high RAM usage).
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
                                setEpubReaderSettings({
                                    textSelect: !e.currentTarget.checked,
                                }),
                            );
                        }}
                        labelAfter="EPUB: Disable Text Select / Enable double-click zen mode"
                    />
                    <div className="desc">
                        Removes ability to select text in epub reader and enabled double-click zen mode.
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
                                }),
                            );
                        }}
                        labelAfter="Location List Numbering"
                    />
                    <div className="desc">Enabled Location List Numbering. This will be applied to all lists.</div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={!appSettings.readerSettings.disableChapterTransitionScreen}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                setReaderSettings({
                                    disableChapterTransitionScreen: !e.currentTarget.checked,
                                }),
                            );
                        }}
                        labelAfter="Chapter Transition screen"
                    />
                    <div className="desc">
                        Show the chapter transition screen that show up at start and end of chapter (only in
                        vertical scroll Reading mode).
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
                                }),
                            );
                        }}
                        labelAfter="More Info on Bookmark / History Hover"
                    />
                    <div className="desc">
                        Show more info such as &quot;date&quot;, &quot;total pages&quot;, &quot;last page
                        number&quot;, &quot;path&quot; when mouse over items in bookmark / history tab.
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
                                }),
                            );
                        }}
                        labelAfter="Reader Settings Checkbox"
                    />
                    <div className="desc">Show checkbox instead of toggle in reader settings.</div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={appSettings.showPageCountInSideList}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                setAppSettings({
                                    showPageCountInSideList: e.currentTarget.checked,
                                }),
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
                                }),
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
                            dialogUtils
                                .warn({
                                    title: "Reset library",
                                    message:
                                        "This will delete all entries from library including bookmarks. Continue?",
                                    noOption: false,
                                    defaultId: 0,
                                })
                                .then(({ response }) => {
                                    if (response === undefined) return;
                                    if (response === 1) return;
                                    if (response === 0) {
                                        dialogUtils
                                            .warn({
                                                title: "Reset library",
                                                message:
                                                    "This will delete all entries from library including bookmarks. Continue?",
                                                noOption: false,
                                                buttons: ["Cancel", "Reset"],
                                                defaultId: 0,
                                            })
                                            .then(({ response }) => {
                                                if (!response) return;
                                                dispatch(resetLibrary());
                                            });
                                    }
                                });
                        }}
                    >
                        Reset Library
                    </button>
                    <button
                        onClick={() => {
                            dialogUtils
                                .warn({
                                    title: "Reset themes",
                                    message: "This will delete all Themes. Continue?",
                                    noOption: false,
                                })
                                .then(({ response }) => {
                                    if (response === undefined) return;
                                    if (response === 1) return;
                                    if (response === 0) {
                                        dialogUtils
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
                            dialogUtils
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
                            dialogUtils
                                .warn({
                                    title: "Reset Settings",
                                    message: "This will reset all Settings. Continue?",
                                    noOption: false,
                                })
                                .then(({ response }) => {
                                    if (response === undefined) return;
                                    if (response === 1) return;
                                    if (response === 0) {
                                        dialogUtils
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
    );
};

export default GeneralSettings;
