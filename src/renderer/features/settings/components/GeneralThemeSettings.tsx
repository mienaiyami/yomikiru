import { faEdit, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { addThemes, deleteTheme, newTheme, setTheme } from "@store/themes";
import { dialogUtils } from "@utils/dialog";
import { createRendererLogger } from "@utils/logger";
import { initThemeData } from "@utils/theme";
import { useTranslation } from "react-i18next";
import { useSettingsContext } from "../Settings";
import { settingsTabIndex } from "../utils/constants";
import { navigateToSetting } from "../utils/navigateToSetting";

const log = createRendererLogger("settings/GeneralThemeSettings");

const GeneralThemeSettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const { setCurrentTab } = useSettingsContext();
    const theme = useAppSelector((store) => store.theme.name);
    const allThemes = useAppSelector((store) => store.theme.allData);
    const dispatch = useAppDispatch();
    return (
        <div className="settingItem2" id="settings-theme">
            <h3>{t("theme.title")}</h3>
            <div className="main row">
                {allThemes.map((e) => (
                    <div className="themeButtons" key={e.name}>
                        <button
                            className={`${theme === e.name ? "selected" : ""} ${
                                initThemeData.allData.map((e) => e.name).includes(e.name) ? "default" : ""
                            }`}
                            onClick={() => dispatch(setTheme(e.name))}
                            title={e.name}
                        >
                            {e.name}
                        </button>
                    </div>
                ))}
                <div className="row">
                    <button
                        onClick={() => {
                            setCurrentTab(settingsTabIndex("makeTheme"));
                        }}
                    >
                        <FontAwesomeIcon icon={faPlus} /> <span className="icon">/</span>{" "}
                        <FontAwesomeIcon icon={faEdit} />
                    </button>
                    {!initThemeData.allData.map((q) => q.name).includes(theme) && (
                        <button
                            onClick={() => {
                                dialogUtils
                                    .confirm({
                                        message: t("theme.deleteTheme", { theme }),
                                        noOption: false,
                                    })
                                    .then((res) => {
                                        if (res.response === 0) {
                                            const themeIndex = allThemes.findIndex((e) => e.name === theme);
                                            if (themeIndex > -1 && allThemes[themeIndex - 1]) {
                                                dispatch(setTheme(allThemes[themeIndex - 1].name));
                                                dispatch(deleteTheme(themeIndex));
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
                        onClick={async () => {
                            const opt = await dialogUtils.showSaveDialog({
                                title: t("theme.exportTitle"),
                                defaultPath: "yomikiru-themes.json",
                                filters: [
                                    {
                                        name: "json",
                                        extensions: ["json"],
                                    },
                                ],
                            });
                            if (!opt.filePath) return;
                            const themeForExport = allThemes.filter(
                                (e) => !initThemeData.allData.map((e) => e.name).includes(e.name),
                            );
                            window.electron.invoke("fs:saveFile", {
                                filePath: opt.filePath,
                                data: JSON.stringify(themeForExport, null, "\t"),
                            });
                        }}
                    >
                        {t("shared.export")}
                    </button>
                    <button
                        onClick={async () => {
                            const opt = await dialogUtils.showOpenDialog({
                                properties: ["openFile"],
                                filters: [
                                    {
                                        name: "Json",
                                        extensions: ["json"],
                                    },
                                ],
                            });
                            if (!opt.filePaths.length) return;
                            const data: ThemeData[] | Themes = JSON.parse(
                                await window.fs.readFile(opt.filePaths[0], "utf8"),
                            );
                            const dataToAdd: ThemeData[] = [];
                            let importedCount = 0;
                            const existingThemeNames = allThemes.map((e) => e.name);
                            if (!Array.isArray(data)) {
                                if ("name" in data && "allData" in data) {
                                    data.allData.forEach((e, i) => {
                                        if ("name" in e && "main" in e) {
                                            if (
                                                existingThemeNames.includes(e.name) ||
                                                dataToAdd.map((a) => a.name).includes(e.name)
                                            ) {
                                                dialogUtils.warn({
                                                    message: t("theme.sameName", { name: e.name }),
                                                });
                                            } else {
                                                dataToAdd.push(e);
                                                importedCount++;
                                            }
                                        } else log.warn(`Theme import: skipped invalid row at index ${i}`);
                                    });
                                } else {
                                    dialogUtils.customError({
                                        message: t("theme.badFormat"),
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
                                            dialogUtils.warn({
                                                message: t("theme.sameName", { name: e.name }),
                                            });
                                        } else {
                                            dataToAdd.push(e);
                                            importedCount++;
                                        }
                                    } else log.warn(`Theme import: skipped invalid row at index ${i}`);
                                });
                            dialogUtils.confirm({
                                title: t("theme.importedTitle"),
                                message: t("theme.importedCount", { count: importedCount }),
                                noOption: true,
                            });
                            dispatch(addThemes(dataToAdd));
                        }}
                    >
                        {t("shared.import")}
                    </button>
                    <button
                        onClick={() =>
                            window.electron.openExternal("https://github.com/mienaiyami/yomikiru/discussions/191")
                        }
                    >
                        {t("theme.shareTheme")}
                    </button>
                </div>
                <div className="desc">
                    {t("theme.shareDesc")}{" "}
                    <a
                        onClick={() => {
                            navigateToSetting("usage:copy-theme", dispatch);
                        }}
                        id="settings-copyTheme"
                    >
                        {t("shared.moreInfoDot")}
                    </a>
                </div>
                <div className="main row">
                    <button
                        onClick={() => {
                            const theme = window.electron.readText("clipboard");
                            if (theme) {
                                try {
                                    const themeJSON = JSON.parse(theme);
                                    if (themeJSON) {
                                        if ("name" in themeJSON && "main" in themeJSON) {
                                            if (allThemes.map((e) => e.name).includes(themeJSON.name)) {
                                                dialogUtils.warn({
                                                    message: t("theme.sameName", { name: themeJSON.name }),
                                                });
                                            } else {
                                                dispatch(newTheme(themeJSON));
                                            }
                                        } else
                                            dialogUtils.customError({
                                                title: t("theme.failedTitle"),
                                                message: t("theme.invalidThemeData"),
                                            });
                                    }
                                } catch (reason) {
                                    log.error("Theme import: file read or parse failed", reason);
                                    dialogUtils.customError({
                                        title: t("theme.failedTitle"),
                                        message: t("theme.invalidThemeData"),
                                    });
                                }
                            }
                        }}
                    >
                        {t("theme.saveFromClipboard")}
                    </button>
                    <button
                        onClick={(e) => {
                            const currentTheme = allThemes.find((e) => e.name === theme);
                            if (currentTheme) {
                                try {
                                    window.electron.writeText(JSON.stringify(currentTheme, null, "\t"));
                                    const target = e.currentTarget;
                                    const oldText = target.innerText;
                                    target.innerText = `${"\u00a0".repeat(23)}${t("shared.copied")}${"\u00a0".repeat(23)}`;
                                    target.disabled = true;
                                    setTimeout(() => {
                                        target.disabled = false;
                                        target.innerText = oldText;
                                    }, 3000);
                                } catch (reason) {
                                    dialogUtils.customError({
                                        message: t("theme.failedToCopy", { reason }),
                                    });
                                }
                            }
                        }}
                    >
                        {t("theme.copyCurrent")}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeneralThemeSettings;
