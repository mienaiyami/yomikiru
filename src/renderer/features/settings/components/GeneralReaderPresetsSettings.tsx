import { faChevronDown, faChevronUp, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    addBookPresets,
    addMangaPresets,
    deleteReaderPresetWithFallback,
    getBookPresets,
    getMangaPresets,
    movePreset,
    resetReaderPresetsToDefaults,
    selectReaderPreset,
} from "@store/readerPresets";
import { dialogUtils } from "@utils/dialog";
import { createRendererLogger } from "@utils/logger";
import type { BookReaderPreset, MangaReaderPreset } from "@utils/readerPresets";
import { isUserPresetId, parsePresetImport } from "@utils/readerPresets";
import { useTranslation } from "react-i18next";
import { navigateToSetting } from "../utils/navigateToSetting";

const log = createRendererLogger("settings/GeneralReaderPresetsSettings");

type PresetActionsRowViewProps = {
    type: "manga" | "book";
    title: string;
    presets: Array<MangaReaderPreset | BookReaderPreset>;
    currentPresetId: string;
};

/**
 * Shared reader-preset list UI (reorder, select, export/import, copy). Wired by manga/book settings rows.
 */
const PresetActionsRowView = ({ type, title, presets, currentPresetId }: PresetActionsRowViewProps) => {
    const { t } = useTranslation("settings");
    const dispatch = useAppDispatch();
    return (
        <div className="col">
            <h4>{t("readerPresets.presetsHeading", { title })}</h4>
            <ul className="presetList">
                {presets.map((preset, idx) => {
                    const isSelected = currentPresetId === preset.id;
                    const canMoveUp = presets.length > 1 && idx > 0;
                    const canMoveDown = presets.length > 1 && idx < presets.length - 1;
                    return (
                        <li key={preset.id} className={`row presetItem ${isSelected ? "presetItemSelected" : ""}`}>
                            <span className="presetName" title={preset.name}>
                                {idx < 5 ? (
                                    <>
                                        <code>{idx + 1}</code>{" "}
                                    </>
                                ) : (
                                    ""
                                )}
                                {preset.name}
                            </span>
                            {presets.length > 1 && (
                                <>
                                    <button
                                        disabled={!canMoveUp}
                                        onClick={() => dispatch(movePreset({ id: preset.id, direction: "up" }))}
                                        title={t("readerPresets.moveUp")}
                                    >
                                        <FontAwesomeIcon icon={faChevronUp} />
                                    </button>
                                    <button
                                        disabled={!canMoveDown}
                                        onClick={() => dispatch(movePreset({ id: preset.id, direction: "down" }))}
                                        title={t("readerPresets.moveDown")}
                                    >
                                        <FontAwesomeIcon icon={faChevronDown} />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => dispatch(selectReaderPreset(preset.id))}
                                className={isSelected ? "optionSelected" : ""}
                            >
                                {t("shared.select")}
                            </button>
                            {presets.length > 1 && (
                                <button
                                    // added disable to prevent UI structure breaking
                                    disabled={isUserPresetId(preset.id)}
                                    onClick={() => {
                                        dialogUtils
                                            .confirm({
                                                message: t("readerPresets.deleteConfirm"),
                                                noOption: false,
                                            })
                                            .then((res) => {
                                                if (res.response === 0) {
                                                    dispatch(deleteReaderPresetWithFallback(preset.id));
                                                }
                                            });
                                    }}
                                    title={t("readerPresets.deletePreset")}
                                >
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
            <div className="row">
                <button
                    onClick={async () => {
                        const opt = await dialogUtils.showSaveDialog({
                            title: t("readerPresets.exportTitle", { title }),
                            defaultPath: `yomikiru-${type}ReaderPresets.json`,
                            filters: [{ name: "json", extensions: ["json"] }],
                        });
                        if (!opt.filePath) return;
                        window.electron.invoke("fs:saveFile", {
                            filePath: opt.filePath,
                            data: JSON.stringify(presets, null, "\t"),
                        });
                    }}
                >
                    {t("shared.export")}
                </button>
                <button
                    onClick={async () => {
                        const opt = await dialogUtils.showOpenDialog({
                            properties: ["openFile"],
                            filters: [{ name: "Json", extensions: ["json"] }],
                        });
                        if (!opt.filePaths.length) return;
                        try {
                            const raw = await window.fs.readFile(opt.filePaths[0], "utf8");
                            const data = JSON.parse(raw);
                            const validated = parsePresetImport(data).filter((p) => p.type === type);
                            const toAdd = validated.filter((p) => !presets.some((e) => e.id === p.id));
                            const skipped = validated.length - toAdd.length;
                            if (toAdd.length > 0) {
                                if (type === "manga") dispatch(addMangaPresets(toAdd as MangaReaderPreset[]));
                                else dispatch(addBookPresets(toAdd as BookReaderPreset[]));
                            }
                            dialogUtils.confirm({
                                title: t("theme.importedTitle"),
                                message: `${t("readerPresets.importedCount", { count: toAdd.length })}${skipped > 0 ? t("readerPresets.skippedDuplicates", { skipped }) : ""}`,
                                noOption: true,
                            });
                        } catch (err) {
                            log.error(err);
                            dialogUtils.customError({
                                message: t("readerPresets.invalidFile"),
                                log: false,
                            });
                        }
                    }}
                >
                    {t("shared.import")}
                </button>
                <button
                    onClick={(e) => {
                        const current = currentPresetId ? presets.find((p) => p.id === currentPresetId) : null;
                        if (current) {
                            try {
                                window.electron.writeText(JSON.stringify(current, null, "\t"));
                                const target = e.currentTarget as HTMLButtonElement;
                                const old = target.innerText;
                                target.innerText = t("shared.copied");
                                target.disabled = true;
                                setTimeout(() => {
                                    target.disabled = false;
                                    target.innerText = old;
                                }, 3000);
                            } catch (reason) {
                                dialogUtils.customError({
                                    message: t("readerPresets.failedToCopy", { reason }),
                                });
                            }
                        } else {
                            dialogUtils.warn({
                                message: t("readerPresets.noPresetSelected"),
                            });
                        }
                    }}
                >
                    {t("readerPresets.copyCurrent")}
                </button>
            </div>
        </div>
    );
};

/** Manga preset list row; subscribes only to {@link getMangaPresets}. */
const MangaPresetActionsRow = () => {
    const presets = useAppSelector(getMangaPresets);
    const currentPresetId = useAppSelector((s) => s.appSettings.mangaReaderPresetId);
    return <PresetActionsRowView type="manga" title="Manga" presets={presets} currentPresetId={currentPresetId} />;
};

/** Book preset list row; subscribes only to {@link getBookPresets}. */
const BookPresetActionsRow = () => {
    const presets = useAppSelector(getBookPresets);
    const currentPresetId = useAppSelector((s) => s.appSettings.bookReaderPresetId);
    return <PresetActionsRowView type="book" title="Book" presets={presets} currentPresetId={currentPresetId} />;
};

/**
 * Reader presets: reset defaults, manga/book export/import/share.
 */
const GeneralReaderPresetsSettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const dispatch = useAppDispatch();
    const presets = useAppSelector((s) => s.readerPresets.presets);

    const handleSavePresetFromClipboard = () => {
        const text = window.electron.readText("clipboard");
        try {
            if (!text) throw new Error("No preset data in clipboard.");
            const parsed = JSON.parse(text) as unknown;
            const validated = parsePresetImport(Array.isArray(parsed) ? parsed : [parsed]);
            const p = validated[0];
            if (!p) throw new Error("Invalid format");
            if (presets.some((e) => e.id === p.id)) {
                dialogUtils.warn({ message: t("readerPresets.idExists") });
                return;
            }
            if (p.type === "manga") dispatch(addMangaPresets([p as MangaReaderPreset]));
            else dispatch(addBookPresets([p as BookReaderPreset]));
            dialogUtils.confirm({
                title: t("theme.importedTitle"),
                message: t("readerPresets.importedPreset", { name: p.name }),
                noOption: true,
            });
        } catch {
            dialogUtils.customError({
                message: t("readerPresets.invalidClipboard"),
                log: false,
            });
        }
    };

    return (
        <div className="settingItem2" id="settings-reader-presets">
            <h3>{t("readerPresets.title")}</h3>
            <div className="desc">
                {t("readerPresets.desc")}{" "}
                <a onClick={() => navigateToSetting("usage:reader-presets", dispatch)} id="settings-readerPresets">
                    {t("shared.moreInfo")}
                </a>
            </div>
            <div className="main col">
                <div className="row">
                    <button
                        onClick={() => {
                            dialogUtils
                                .confirm({
                                    message: t("readerPresets.resetDefaultsConfirm"),
                                    noOption: false,
                                })
                                .then((res) => {
                                    if (res.response === 0) dispatch(resetReaderPresetsToDefaults());
                                });
                        }}
                    >
                        {t("readerPresets.resetDefaults")}
                    </button>
                    <button onClick={handleSavePresetFromClipboard}>{t("readerPresets.saveFromClipboard")}</button>
                </div>
                <MangaPresetActionsRow />
                <BookPresetActionsRow />
            </div>
        </div>
    );
};

export default GeneralReaderPresetsSettings;
