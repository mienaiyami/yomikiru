import { useAppDispatch, useAppSelector } from "@store/hooks";
import { addThemes, deleteTheme, newTheme, setTheme } from "@store/themes";
import { initThemeData } from "@utils/theme";
import { useSettingsContext } from "../Settings";
import { TAB_INFO } from "../utils/constants";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { dialogUtils } from "@utils/dialog";

const GeneralThemeSettings: React.FC = () => {
    const { scrollIntoView, setCurrentTab } = useSettingsContext();
    const theme = useAppSelector((store) => store.theme.name);
    const allThemes = useAppSelector((store) => store.theme.allData);
    const dispatch = useAppDispatch();
    return (
        <div className="settingItem2" id="settings-theme">
            <h3>Theme</h3>
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
                            setCurrentTab(TAB_INFO.makeTheme[0]);
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
                                        message: `Delete theme "${theme}"`,
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
                                title: "Export Themes",
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
                        Export
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
                            if (!(data instanceof Array)) {
                                if ("name" in data && "allData" in data) {
                                    data.allData.forEach((e, i) => {
                                        if ("name" in e && "main" in e) {
                                            if (
                                                existingThemeNames.includes(e.name) ||
                                                dataToAdd.map((a) => a.name).includes(e.name)
                                            ) {
                                                dialogUtils.warn({
                                                    message:
                                                        "Same theme name detected. Wont be imported.\nName: " +
                                                        e.name,
                                                });
                                            } else {
                                                dataToAdd.push(e);
                                                importedCount++;
                                            }
                                        } else window.logger.warn("IMPORTING THEMES: Invalid data at index", i);
                                    });
                                } else {
                                    dialogUtils.customError({
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
                                            dialogUtils.warn({
                                                message:
                                                    "Same theme name detected. Wont be imported.\nName: " + e.name,
                                            });
                                        } else {
                                            dataToAdd.push(e);
                                            importedCount++;
                                        }
                                    } else window.logger.warn("IMPORTING THEMES: Invalid data at index", i);
                                });
                            dialogUtils.confirm({
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
                            window.electron.openExternal("https://github.com/mienaiyami/yomikiru/discussions/191")
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
                            const theme = window.electron.readText("clipboard");
                            if (theme) {
                                try {
                                    const themeJSON = JSON.parse(theme);
                                    if (themeJSON) {
                                        if ("name" in themeJSON && "main" in themeJSON) {
                                            if (allThemes.map((e) => e.name).includes(themeJSON.name)) {
                                                dialogUtils.warn({
                                                    message:
                                                        "Same theme name detected. Wont be imported.\nName: " +
                                                        themeJSON.name,
                                                });
                                            } else {
                                                dispatch(newTheme(themeJSON));
                                            }
                                        } else
                                            dialogUtils.customError({
                                                title: "Failed",
                                                message: `Invalid theme data. Please note that data must be similar to the result of "Copy Current Theme to Clipboard"`,
                                            });
                                    }
                                } catch (reason) {
                                    dialogUtils.customError({
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
                                    window.electron.writeText(JSON.stringify(currentTheme, null, "\t"));
                                    const target = e.currentTarget;
                                    const oldText = target.innerText;
                                    target.innerText = "\u00a0".repeat(23) + "Copied!" + "\u00a0".repeat(23);
                                    target.disabled = true;
                                    setTimeout(() => {
                                        target.disabled = false;
                                        target.innerText = oldText;
                                    }, 3000);
                                } catch (reason) {
                                    dialogUtils.customError({
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
    );
};

export default GeneralThemeSettings;
