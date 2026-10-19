import {
    BookReaderSettingSection,
    MangaReaderSettingSection,
} from "@features/reader/components/ReaderSettingSection";
import { faPlus, faSave, faSync, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    selectLiveBookPresetId,
    selectLiveBookReaderSettings,
    selectLiveMangaPresetId,
    selectLiveMangaReaderSettings,
} from "@store/reader";
import {
    addBookPreset,
    addMangaPreset,
    deleteReaderPresetWithFallback,
    getBookPresets,
    getMangaPresets,
    selectPresetInContext,
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
    /** Which live `settingsCollapsed.preset` map to toggle. */
    itemType: "manga" | "book";
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
        itemType,
        onSelect,
        onAdd,
        onToggleAutosave,
        onUpdateSelected,
        onDeleteSelected,
    }: ReaderPresetSectionViewProps) => {
        const { t } = useTranslation("reader");
        const [showPresetNameModal, setShowPresetNameModal] = useState(false);
        const preset = presets.find((p) => p.id === presetId);
        const Section = itemType === "manga" ? MangaReaderSettingSection : BookReaderSettingSection;

        return (
            <>
                <Section title={t("settings.preset")} collapsedKey="preset">
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
                            <button onClick={() => setShowPresetNameModal(true)} title={t("presets.saveAsNew")}>
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
                </Section>
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
    const presetId = useAppSelector(selectLiveMangaPresetId);
    const readerSettings = useAppSelector(selectLiveMangaReaderSettings);

    return (
        <ReaderPresetSectionView
            presets={presets}
            presetId={presetId}
            itemType="manga"
            onSelect={(id) => dispatch(selectPresetInContext(id))}
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
                dispatch(selectPresetInContext(newId));
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
    const presetId = useAppSelector(selectLiveBookPresetId);
    const epubReaderSettings = useAppSelector(selectLiveBookReaderSettings);

    return (
        <ReaderPresetSectionView
            presets={presets}
            presetId={presetId}
            itemType="book"
            onSelect={(id) => dispatch(selectPresetInContext(id))}
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
                dispatch(selectPresetInContext(newId));
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
