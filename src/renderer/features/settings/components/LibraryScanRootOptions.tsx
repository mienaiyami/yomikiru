import { ItemTagsPicker } from "@features/home/gallery/components/ItemTagsPicker";
import { useAppDispatch } from "@store/hooks";
import { compileLibraryScanSkipRegex } from "@common/library/classify";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { navigateToSetting } from "../utils/navigateToSetting";

/** Delay before skip-pattern edits are written; matches InputNumber timeout on sibling scan fields. */
const SKIP_PATTERN_PERSIST_MS = 500;

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
    const [draftSkip, setDraftSkip] = useState(skipPattern);
    const onSkipRef = useRef(onSkipPatternChange);
    onSkipRef.current = onSkipPatternChange;
    const compiled = compileLibraryScanSkipRegex(draftSkip);
    const skipFieldId = `${skipInputId}-input`;

    useEffect(() => {
        setDraftSkip(skipPattern);
    }, [skipPattern]);

    useEffect(() => {
        if (draftSkip === skipPattern) return;
        const timer = window.setTimeout(() => {
            onSkipRef.current(draftSkip);
        }, SKIP_PATTERN_PERSIST_MS);
        return () => window.clearTimeout(timer);
    }, [draftSkip, skipPattern]);

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
                        value={draftSkip}
                        disabled={disabled}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder={t("library.skipPatternPlaceholder")}
                        onChange={(e) => setDraftSkip(e.currentTarget.value)}
                        onBlur={() => {
                            if (draftSkip !== skipPattern) onSkipPatternChange(draftSkip);
                        }}
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
