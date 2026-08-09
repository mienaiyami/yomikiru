import { faPlus, faSave, faSync, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setEpubReaderSettings, setReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    addBookPreset,
    addMangaPreset,
    deleteReaderPresetWithFallback,
    getBookPresets,
    getMangaPresets,
    selectReaderPreset,
    setPresetAutosave,
    updateBookPreset,
    updateMangaPreset,
} from "@store/readerPresets";
import TextInputModal from "@ui/TextInputModal";
import { dialogUtils } from "@utils/dialog";
import { type BookReaderPreset, isUserPresetId, type MangaReaderPreset } from "@utils/readerPresets";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";

type PresetRow = {
    id: string;
    name: string;
    autosave: boolean;
};

type ReaderPresetSectionViewProps = {
    presets: PresetRow[];
    presetId: string;
    isCollapsed: boolean;
    onToggleCollapsed: () => void;
    onSelect: (id: string) => void;
    onAdd: (name: string) => void;
    onToggleAutosave: (id: string, next: boolean) => void;
    onUpdateSelected: () => void;
    onDeleteSelected: () => void;
};

/**
 * Shared preset UI (list, add/update/delete, autosave). Wired by manga/book containers.
 */
const ReaderPresetSectionView = memo(
    ({
        presets,
        presetId,
        isCollapsed,
        onToggleCollapsed,
        onSelect,
        onAdd,
        onToggleAutosave,
        onUpdateSelected,
        onDeleteSelected,
    }: ReaderPresetSectionViewProps) => {
        const { t } = useTranslation("reader");
        const [showPresetNameModal, setShowPresetNameModal] = useState(false);
        const preset = presets.find((p) => p.id === presetId);

        return (
            <>
                <div className="settingItem">
                    <div
                        className={`name ${!isCollapsed ? "expanded " : ""}`}
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                        }}
                        onClick={onToggleCollapsed}
                    >
                        {t("settings.preset")}
                    </div>
                    <div className="options">
                        <div className="col">
                            {presets.map((p, idx) => {
                                const isSelected = presetId === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        className={isSelected ? "optionSelected" : ""}
                                        onClick={() => onSelect(p.id)}
                                        title={p.name}
                                    >
                                        {idx < 5 ? (
                                            <>
                                                <code>{idx + 1}</code>{" "}
                                            </>
                                        ) : (
                                            ""
                                        )}
                                        {p.name}
                                    </button>
                                );
                            })}
                            <div className="row stretch-content">
                                <button
                                    onClick={() => setShowPresetNameModal(true)}
                                    title={t("presets.saveAsNew")}
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                                {preset && (
                                    <>
                                        <button
                                            className={preset.autosave ? "optionSelected" : ""}
                                            onClick={() => onToggleAutosave(preset.id, !preset.autosave)}
                                            title={
                                                preset.autosave
                                                    ? t("presets.disableAutosave")
                                                    : t("presets.enableAutosave")
                                            }
                                        >
                                            <FontAwesomeIcon icon={faSync} />
                                        </button>
                                        <button onClick={onUpdateSelected} title={t("presets.updateSelected")}>
                                            <FontAwesomeIcon icon={faSave} />
                                        </button>
                                        {presets.length > 1 && presetId && !isUserPresetId(presetId) && (
                                            <button onClick={onDeleteSelected} title={t("presets.deletePreset")}>
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {showPresetNameModal && (
                    <TextInputModal
                        title={t("presets.nameTitle")}
                        placeholder={t("presets.namePlaceholder")}
                        onClose={() => setShowPresetNameModal(false)}
                        onSave={(name) => {
                            onAdd(name);
                            setShowPresetNameModal(false);
                        }}
                    />
                )}
            </>
        );
    },
);

ReaderPresetSectionView.displayName = "ReaderPresetSectionView";

/**
 * Manga reader preset section - subscribes only to {@link getMangaPresets}.
 */
export const MangaReaderPresetSection = memo(() => {
    const { t } = useTranslation("reader");
    const dispatch = useAppDispatch();
    const presets = useAppSelector(getMangaPresets);
    const presetId = useAppSelector((s) => s.appSettings.mangaReaderPresetId);
    const readerSettings = useAppSelector((s) => s.appSettings.readerSettings);
    const isCollapsed = readerSettings.settingsCollapsed.preset ?? false;

    return (
        <ReaderPresetSectionView
            presets={presets}
            presetId={presetId}
            isCollapsed={isCollapsed}
            onToggleCollapsed={() =>
                dispatch(
                    setReaderSettings({
                        settingsCollapsed: {
                            ...readerSettings.settingsCollapsed,
                            preset: !isCollapsed,
                        },
                    }),
                )
            }
            onSelect={(id) => dispatch(selectReaderPreset(id))}
            onAdd={(name) => {
                const newId = crypto.randomUUID();
                const payload: MangaReaderPreset = {
                    id: newId,
                    name,
                    type: "manga",
                    autosave: false,
                    data: readerSettings,
                };
                dispatch(addMangaPreset(payload));
                dispatch(selectReaderPreset(newId));
            }}
            onToggleAutosave={(id, autosave) => dispatch(setPresetAutosave({ id, autosave }))}
            onUpdateSelected={() => {
                const selected = presets.find((p) => p.id === presetId);
                if (!selected) return;
                dispatch(updateMangaPreset({ id: selected.id, data: readerSettings }));
                dialogUtils.confirm({ message: t("dialogs.presetUpdated"), noOption: true });
            }}
            onDeleteSelected={() => {
                if (!presetId) return;
                dialogUtils.confirm({ message: t("dialogs.deletePreset"), noOption: false }).then((res) => {
                    if (res.response === 0) dispatch(deleteReaderPresetWithFallback(presetId));
                });
            }}
        />
    );
});

MangaReaderPresetSection.displayName = "MangaReaderPresetSection";

/**
 * Book/EPUB reader preset section - subscribes only to {@link getBookPresets}.
 */
export const BookReaderPresetSection = memo(() => {
    const { t } = useTranslation("reader");
    const dispatch = useAppDispatch();
    const presets = useAppSelector(getBookPresets);
    const presetId = useAppSelector((s) => s.appSettings.bookReaderPresetId);
    const epubReaderSettings = useAppSelector((s) => s.appSettings.epubReaderSettings);
    const isCollapsed = epubReaderSettings.settingsCollapsed.preset ?? false;

    return (
        <ReaderPresetSectionView
            presets={presets}
            presetId={presetId}
            isCollapsed={isCollapsed}
            onToggleCollapsed={() =>
                dispatch(
                    setEpubReaderSettings({
                        settingsCollapsed: {
                            ...epubReaderSettings.settingsCollapsed,
                            preset: !isCollapsed,
                        },
                    }),
                )
            }
            onSelect={(id) => dispatch(selectReaderPreset(id))}
            onAdd={(name) => {
                const newId = crypto.randomUUID();
                const payload: BookReaderPreset = {
                    id: newId,
                    name,
                    type: "book",
                    autosave: false,
                    data: epubReaderSettings,
                };
                dispatch(addBookPreset(payload));
                dispatch(selectReaderPreset(newId));
            }}
            onToggleAutosave={(id, autosave) => dispatch(setPresetAutosave({ id, autosave }))}
            onUpdateSelected={() => {
                const selected = presets.find((p) => p.id === presetId);
                if (!selected) return;
                dispatch(updateBookPreset({ id: selected.id, data: epubReaderSettings }));
                dialogUtils.confirm({ message: t("dialogs.presetUpdated"), noOption: true });
            }}
            onDeleteSelected={() => {
                if (!presetId) return;
                dialogUtils.confirm({ message: t("dialogs.deletePreset"), noOption: false }).then((res) => {
                    if (res.response === 0) dispatch(deleteReaderPresetWithFallback(presetId));
                });
            }}
        />
    );
});

BookReaderPresetSection.displayName = "BookReaderPresetSection";
