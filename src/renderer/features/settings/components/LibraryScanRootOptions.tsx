import { ItemTagsPicker } from "@features/home/gallery/components/ItemTagsPicker";
import { useAppDispatch } from "@store/hooks";
import { compileLibraryScanSkipRegex } from "@utils/mangaChapters";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { navigateToSetting } from "../utils/navigateToSetting";

type LibraryScanRootOptionsProps = {
    skipPattern: string;
    tagIds: readonly number[];
    skipInputId: string;
    tagsId: string;
    disabled: boolean;
    onSkipPatternChange: (value: string) => void;
    onTagIdsChange: (ids: number[]) => void;
    onBackfill: () => void;
    backfillBusy: boolean;
    backfillFeedback: "idle" | "saving" | "saved" | "failed";
};

/**
 * Per-root skip regex plus a Tags button used by Default Location and extra folders.
 * Catalog pick and backfill use {@link ItemTagsPicker} in selection mode.
 */
const LibraryScanRootOptions = ({
    skipPattern,
    tagIds,
    skipInputId,
    tagsId,
    disabled,
    onSkipPatternChange,
    onTagIdsChange,
    onBackfill,
    backfillBusy,
    backfillFeedback,
}: LibraryScanRootOptionsProps) => {
    const { t } = useTranslation("settings");
    const dispatch = useAppDispatch();
    const [pickerOpen, setPickerOpen] = useState(false);
    const compiled = compileLibraryScanSkipRegex(skipPattern);
    const skipFieldId = `${skipInputId}-input`;

    const backfillLabel =
        backfillFeedback === "saving"
            ? t("library.backfillSaving")
            : backfillFeedback === "saved"
              ? t("library.backfillSaved")
              : backfillFeedback === "failed"
                ? t("library.backfillFailed")
                : t("library.backfillTags");

    return (
        <div className="col libraryScanRootOptions">
            <div className="row libraryFolderRow libraryScanRootRow" id={skipInputId}>
                <label className={`${disabled ? "disabled " : ""}noBG`} htmlFor={skipFieldId}>
                    {t("library.skipPattern")}
                    <input
                        id={skipFieldId}
                        type="text"
                        className="librarySkipPatternInput"
                        value={skipPattern}
                        disabled={disabled}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder={t("library.skipPatternPlaceholder")}
                        onChange={(e) => onSkipPatternChange(e.currentTarget.value)}
                    />
                </label>
                <a
                    onClick={() => {
                        navigateToSetting("usage:library-scan", dispatch);
                    }}
                >
                    {t("shared.moreInfo")}
                </a>
                <button type="button" id={tagsId} disabled={disabled} onClick={() => setPickerOpen(true)}>
                    {t("library.folderTags")}
                </button>
            </div>
            {compiled.status === "invalid" ? (
                <div className="desc librarySkipPatternError">{t("library.skipPatternInvalid")}</div>
            ) : null}
            {pickerOpen ? (
                <ItemTagsPicker
                    title={t("library.folderTagsPickerTitle")}
                    selectedIds={tagIds}
                    onSelectedIdsChange={onTagIdsChange}
                    onClose={() => setPickerOpen(false)}
                    extraActions={
                        <button
                            type="button"
                            disabled={disabled || backfillBusy || tagIds.length === 0}
                            data-tooltip={t("library.backfillTooltip")}
                            onClick={onBackfill}
                        >
                            {backfillLabel}
                        </button>
                    }
                />
            ) : null}
        </div>
    );
};

export default LibraryScanRootOptions;
