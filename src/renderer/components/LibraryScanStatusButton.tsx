import { navigateToSetting } from "@features/settings/utils/navigateToSetting";
import { faFolderOpen } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Popover from "@renderer/components/ui/Popover";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { useTranslation } from "react-i18next";

/**
 * Title-bar control while a library scan is running. Shows a live folder label;
 * the popover lists phase, root, current path, and a jump to Library settings.
 */
const LibraryScanStatusButton = () => {
    const { t } = useTranslation("common");
    const dispatch = useAppDispatch();
    const status = useAppSelector((store) => store.ui.libraryScanStatus);
    if (!status) return null;

    const folder = window.path.basename(status.currentPath || status.rootPath) || status.rootPath;
    const phaseLabel =
        status.phase === "walking"
            ? t("topBar.scanPhaseWalking")
            : status.phase === "adding"
              ? t("topBar.scanPhaseAdding")
              : t("topBar.scanPhaseRefreshing");
    const shortLabel =
        status.phase === "adding" && status.addTotal > 0
            ? t("topBar.scanAddingShort", { done: status.addIndex, total: status.addTotal })
            : t("topBar.scanWalkingShort", { folder });

    return (
        <Popover
            className="libraryScanPopover"
            placement="bottom"
            align="start"
            offset={8}
            label={t("topBar.scanningLibrary")}
            trigger={
                <button
                    type="button"
                    className="libraryScanStatus"
                    tabIndex={-1}
                    aria-busy="true"
                    aria-live="polite"
                    aria-label={t("topBar.scanningLibrary")}
                    data-tooltip={t("topBar.scanningLibraryTooltip")}
                    onFocus={(e) => e.currentTarget.blur()}
                >
                    <FontAwesomeIcon icon={faFolderOpen} />
                    <span className="libraryScanStatusLabel">{shortLabel}</span>
                </button>
            }
        >
            {() => (
                <div className="libraryScanPopoverBody">
                    <p className="libraryScanPopoverPhase">{phaseLabel}</p>
                    <p className="libraryScanPopoverFolder" title={status.currentPath || status.rootPath}>
                        {folder}
                    </p>
                    <p className="libraryScanPopoverMeta">
                        {t("topBar.scanRootIndex", { index: status.rootIndex, count: status.rootCount })}
                    </p>
                    {status.phase === "adding" && status.addTotal > 0 ? (
                        <p className="libraryScanPopoverMeta">
                            {t("topBar.scanAddingShort", { done: status.addIndex, total: status.addTotal })}
                        </p>
                    ) : null}
                    <button
                        type="button"
                        className="libraryScanPopoverSettings"
                        onClick={() => navigateToSetting("setting:library-scan-now", dispatch)}
                    >
                        {t("topBar.scanOpenSettings")}
                    </button>
                </div>
            )}
        </Popover>
    );
};

export default LibraryScanStatusButton;
