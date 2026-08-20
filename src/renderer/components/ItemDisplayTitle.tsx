import { useTranslation } from "react-i18next";

type ItemDisplayTitleProps = {
    /** Resolved display title (user overlay, else tracker, else file, else library row). */
    primary: string;
    /** Library row title when it differs from {@link ItemDisplayTitleProps.primary}. */
    original?: string | null;
    className?: string;
};

/**
 * Library item title: primary first, then the original library name in muted parentheses
 * when the two differ. Tooltip / accessible name include both.
 */
export const ItemDisplayTitle = ({ primary, original, className }: ItemDisplayTitleProps) => {
    const { t } = useTranslation("home");
    const originalText = original?.trim() || "";
    const label = originalText ? t("gallery.details.titleWithOriginal", { title: primary, original: originalText }) : primary;

    return (
        <span className={className ? `itemDisplayTitle ${className}` : "itemDisplayTitle"} title={label}>
            {primary}
            {originalText ? <small className="itemDisplayTitle-original"> ({originalText})</small> : null}
        </span>
    );
};
