import { makeNewSettings, setAppSettings, setEpubReaderSettings, setReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { resetLibrary } from "@store/library";
import { updateMainSettings } from "@store/mainSettings";
import { resetShortcuts } from "@store/shortcuts";
import { resetAllTheme } from "@store/themes";
import InputCheckbox from "@ui/InputCheckbox";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { useTranslation } from "react-i18next";
import { useSettingsContext } from "../Settings";
import AnilistSetting from "./AnilistSetting";
import CustomTempLocation from "./CustomTempLocation";
import DbBackupSettings from "./DbBackupSettings";
import FileExplorerOptions from "./FileExplorerOptions";
import GeneralPDFSettings from "./GeneralPDFSettings";
import GeneralReaderPresetsSettings from "./GeneralReaderPresetsSettings";
import GeneralThemeSettings from "./GeneralThemeSettings";
import LanguageSettings from "./LanguageSettings";
import LibrarySettings from "./LibrarySettings";

const GeneralSettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const { scrollIntoView } = useSettingsContext();
    const appSettings = useAppSelector((store) => store.appSettings);
    const mainSettings = useAppSelector((store) => store.mainSettings);
    const dispatch = useAppDispatch();

    return (
        <div className="content2">
            <div className="settingItem2" id="settings-default-location">
                <h3>{t("defaultLocation.title")}</h3>
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
                        {t("defaultLocation.changeDefault")}
                    </button>
                </div>
            </div>
            <GeneralThemeSettings />
            <LanguageSettings />
            <GeneralReaderPresetsSettings />
            {process.platform === "win32" && <FileExplorerOptions />}
            <AnilistSetting />
            <LibrarySettings />
            <GeneralPDFSettings />
            <div className="settingItem2" id="settings-customStylesheet">
                <h3>{t("customStylesheet.title")}</h3>
                <div className="desc">
                    {t("customStylesheet.desc")}{" "}
                    <a
                        onClick={() => {
                            scrollIntoView("#settings-usage-customStylesheet", "extras");
                        }}
                    >
                        {t("shared.moreInfo")}
                    </a>
                </div>
                <div className="main row">
                    <input
                        type="text"
                        placeholder={t("customStylesheet.placeholder")}
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
                                        name: t("customStylesheet.filterName"),
                                    },
                                ],
                            );
                        }}
                    >
                        {t("shared.select")}
                    </button>
                    <button
                        onClick={() => {
                            dispatch(setAppSettings({ customStylesheet: "" }));
                        }}
                    >
                        {t("shared.clear")}
                    </button>
                </div>
            </div>
            <CustomTempLocation />
            <div className="settingItem2 otherSettings" id="settings-otherSettings">
                <h3>{t("otherSettings.title")}</h3>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={mainSettings.hardwareAcceleration}
                        className="noBG"
                        onChange={async (e) => {
                            dispatch(updateMainSettings({ hardwareAcceleration: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.hardwareAcceleration")}
                    />
                    <div className="desc">
                        {t("otherSettings.hardwareAccelerationDesc")} <code>{t("shared.appRestartNeeded")}</code>
                    </div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={mainSettings.askBeforeClosing}
                        className="noBG"
                        onChange={async (e) => {
                            dispatch(updateMainSettings({ askBeforeClosing: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.confirmCloseWindow")}
                    />
                    <div className="desc">{t("otherSettings.confirmCloseWindowDesc")}</div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={mainSettings.minimizeToTray}
                        className="noBG"
                        onChange={async (e) => {
                            dispatch(updateMainSettings({ minimizeToTray: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.minimizeToTray")}
                    />
                    <div className="desc">{t("otherSettings.minimizeToTrayDesc")}</div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={mainSettings.openInExistingWindow}
                        className="noBG"
                        onChange={async (e) => {
                            dispatch(updateMainSettings({ openInExistingWindow: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.useExistingWindow")}
                    />
                    <div className="desc">
                        {t("otherSettings.useExistingWindowDesc")} <code>{t("shared.appRestartNeeded")}</code>
                    </div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={appSettings.openOnDblClick}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(setAppSettings({ openOnDblClick: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.openOnDblClick")}
                    />
                    <div className="desc">{t("otherSettings.openOnDblClickDesc")}</div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={appSettings.syncSettings}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(setAppSettings({ syncSettings: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.syncSettings")}
                    />
                    <div className="desc">
                        {t("otherSettings.syncSettingsDesc")} <code>{t("shared.appRestartNeeded")}</code>
                    </div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={appSettings.syncThemes}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(setAppSettings({ syncThemes: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.syncThemes")}
                    />
                    <div className="desc">
                        {t("otherSettings.syncThemesDesc")} <code>{t("shared.appRestartNeeded")}</code>
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
                        labelAfter={t("otherSettings.chapterOpeningShortcut")}
                    />
                    <div className="desc">
                        {t("otherSettings.chapterOpeningShortcutDesc")}{" "}
                        <a
                            onClick={() => {
                                scrollIntoView("#settings-usage-openDirectlyFromManga", "extras");
                            }}
                        >
                            {t("shared.moreInfo")}
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
                        labelAfter={t("otherSettings.bookmarkHistorySearch")}
                    />
                    <div className="desc">{t("otherSettings.bookmarkHistorySearchDesc")}</div>
                </div>
                <div className="toggleItem" id="settings-classicListCheckboxes">
                    <InputCheckbox
                        checked={appSettings.enableClassicListCheckboxes}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(
                                setAppSettings({
                                    enableClassicListCheckboxes: e.currentTarget.checked,
                                }),
                            );
                        }}
                        labelAfter={t("otherSettings.classicListCheckboxes")}
                    />
                    <div className="desc">{t("otherSettings.classicListCheckboxesDesc")}</div>
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
                        labelAfter={t("otherSettings.confirmSideListDelete")}
                    />
                    <div className="desc">
                        {t("otherSettings.confirmSideListDeleteDesc1")}
                        <br />
                        {t("otherSettings.confirmSideListDeleteDesc2")}
                    </div>
                </div>
                <div className="toggleItem">
                    <InputCheckbox
                        checked={appSettings.openInZenMode}
                        className="noBG"
                        onChange={(e) => {
                            dispatch(setAppSettings({ openInZenMode: e.currentTarget.checked }));
                        }}
                        labelAfter={t("otherSettings.autoZenMode")}
                    />
                    <div className="desc">{t("otherSettings.autoZenModeDesc")}</div>
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
                        labelAfter={t("otherSettings.zenModeCursor")}
                    />
                    <div className="desc">{t("otherSettings.zenModeCursorDesc")}</div>
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
                        labelAfter={t("otherSettings.autoRefreshSideList")}
                    />
                    <div className="desc">{t("otherSettings.autoRefreshSideListDesc")}</div>
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
                        labelAfter={t("otherSettings.canvasBasedRendering")}
                    />
                    <div className="desc">
                        {t("otherSettings.canvasBasedRenderingDesc1")}
                        <br />
                        {t("otherSettings.canvasBasedRenderingDesc2")}
                        <code>{t("shared.experimental")}</code>
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
                        labelAfter={t("otherSettings.dynamicImageLoading")}
                    />
                    <div className="desc">
                        {t("otherSettings.dynamicImageLoadingDesc1")}
                        <br />
                        {t("otherSettings.dynamicImageLoadingDesc2")}
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
                        labelAfter={t("otherSettings.autoFocusChapter")}
                    />
                    <div className="desc">{t("otherSettings.autoFocusChapterDesc")}</div>
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
                        labelAfter={t("otherSettings.epubAutoFocusChapter")}
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
                        labelAfter={t("otherSettings.epubLoadByChapter")}
                    />
                    <div className="desc">
                        {t("otherSettings.epubLoadByChapterDesc1")}
                        <br />
                        {t("otherSettings.epubLoadByChapterDesc2")}
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
                        labelAfter={t("otherSettings.epubDisableTextSelect")}
                    />
                    <div className="desc">{t("otherSettings.epubDisableTextSelectDesc")}</div>
                </div>
            </div>

            <div className="settingItem2 otherSettings">
                <h3>{t("styleSettings.title")}</h3>

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
                        labelAfter={t("styleSettings.locationListNumbering")}
                    />
                    <div className="desc">{t("styleSettings.locationListNumberingDesc")}</div>
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
                        labelAfter={t("styleSettings.chapterTransition")}
                    />
                    <div className="desc">{t("styleSettings.chapterTransitionDesc")}</div>
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
                        labelAfter={t("styleSettings.moreInfoOnHover")}
                    />
                    <div className="desc">{t("styleSettings.moreInfoOnHoverDesc")}</div>
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
                        labelAfter={t("styleSettings.readerSettingsCheckbox")}
                    />
                    <div className="desc">{t("styleSettings.readerSettingsCheckboxDesc")}</div>
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
                        labelAfter={t("styleSettings.showPageCountInSideList")}
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
                        labelAfter={t("styleSettings.showTextFileBadge")}
                    />
                </div>
            </div>
            <DbBackupSettings />
            <div className="settingItem2 dangerZone">
                <h3>{t("reset.title")}</h3>
                <div className="main row">
                    <button
                        onClick={() => {
                            dialogUtils
                                .warn({
                                    title: t("reset.libraryTitle"),
                                    message: t("reset.libraryMessage"),
                                    noOption: false,
                                    defaultId: 0,
                                })
                                .then(({ response }) => {
                                    if (response === undefined) return;
                                    if (response === 1) return;
                                    if (response === 0) {
                                        dialogUtils
                                            .warn({
                                                title: t("reset.libraryTitle"),
                                                message: t("reset.libraryMessage"),
                                                noOption: false,
                                                buttons: [t("shared.cancel"), t("shared.reset")],
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
                        {t("reset.resetLibrary")}
                    </button>
                    <button
                        onClick={() => {
                            dialogUtils
                                .warn({
                                    title: t("reset.themesTitleLower"),
                                    message: t("reset.themesMessage"),
                                    noOption: false,
                                })
                                .then(({ response }) => {
                                    if (response === undefined) return;
                                    if (response === 1) return;
                                    if (response === 0) {
                                        dialogUtils
                                            .warn({
                                                title: t("reset.themesTitle"),
                                                noOption: false,
                                                message: t("reset.themesConfirm"),
                                            })
                                            .then((res) => {
                                                if (res.response === 1) return;
                                                dispatch(resetAllTheme());
                                            });
                                    }
                                });
                        }}
                    >
                        {t("reset.resetThemes")}
                    </button>
                    <button
                        onClick={() => {
                            dialogUtils
                                .warn({
                                    title: t("shared.warning"),
                                    message: t("reset.shortcutsMessage"),
                                    noOption: false,
                                })
                                .then((res) => {
                                    if (res.response === 0) {
                                        dispatch(resetShortcuts());
                                    }
                                });
                        }}
                    >
                        {t("reset.resetShortcuts")}
                    </button>
                    <button
                        onClick={() => {
                            dialogUtils
                                .warn({
                                    title: t("reset.settingsTitle"),
                                    message: t("reset.settingsMessage"),
                                    noOption: false,
                                })
                                .then(({ response }) => {
                                    if (response === undefined) return;
                                    if (response === 1) return;
                                    if (response === 0) {
                                        dialogUtils
                                            .warn({
                                                title: t("reset.settingsTitle"),
                                                noOption: false,
                                                message: t("reset.settingsConfirm"),
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
                        {t("reset.resetSettings")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeneralSettings;
