import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectLiveBookReaderSettings, selectLiveMangaReaderSettings } from "@store/reader";
import { patchLiveBookReaderSettings, patchLiveMangaReaderSettings } from "@store/readerPresets";
import type { BookReaderSettings, MangaReaderSettings } from "@utils/readerSettingsSchema";
import type { ReactElement, ReactNode } from "react";

type ReaderSettingSectionProps = {
    /** Visible header label (chevron + collapse live on this node). */
    title: string;
    /** When true, `.options` is shown (same as the `.name.expanded` CSS contract). */
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
    /** Extra class on `.options` (e.g. `col`). */
    optionsClassName?: string;
    /** Native tooltip on the header. */
    headerTitle?: string;
};

type ReaderSettingSectionBodyProps = Omit<ReaderSettingSectionProps, "expanded" | "onToggle">;

type MangaCollapsedKey = keyof MangaReaderSettings["settingsCollapsed"];
type BookCollapsedKey = keyof BookReaderSettings["settingsCollapsed"];

/**
 * Collapsible in-reader settings block shared by manga and book panels.
 * CSS in `_readerSettings.scss` hides `.options` until `.name` has `expanded`.
 */
export const ReaderSettingSection = ({
    title,
    expanded,
    onToggle,
    children,
    optionsClassName,
    headerTitle,
}: ReaderSettingSectionProps): ReactElement => (
    <div className="settingItem">
        <div
            className={`name ${expanded ? "expanded " : ""}`}
            tabIndex={0}
            title={headerTitle}
            onKeyDown={(e) => {
                if (e.key !== " " && e.key !== "Enter") return;
                e.preventDefault();
                e.currentTarget.click();
            }}
            onClick={onToggle}
        >
            {title}
        </div>
        <div className={optionsClassName ? `options ${optionsClassName}` : "options"}>{children}</div>
    </div>
);

type MangaReaderSettingSectionProps = ReaderSettingSectionBodyProps & {
    /** Key in {@link MangaReaderSettings.settingsCollapsed}. */
    collapsedKey: MangaCollapsedKey;
};

/**
 * Manga in-reader section that toggles {@link MangaReaderSettings.settingsCollapsed} itself.
 */
export const MangaReaderSettingSection = ({
    collapsedKey,
    ...sectionProps
}: MangaReaderSettingSectionProps): ReactElement => {
    const dispatch = useAppDispatch();
    const readerSettings = useAppSelector(selectLiveMangaReaderSettings);
    const isCollapsed = readerSettings.settingsCollapsed[collapsedKey];
    return (
        <ReaderSettingSection
            {...sectionProps}
            expanded={!isCollapsed}
            onToggle={() =>
                dispatch(
                    patchLiveMangaReaderSettings({
                        settingsCollapsed: {
                            ...readerSettings.settingsCollapsed,
                            [collapsedKey]: !isCollapsed,
                        },
                    }),
                )
            }
        />
    );
};

type BookReaderSettingSectionProps = ReaderSettingSectionBodyProps & {
    /** Key in {@link BookReaderSettings.settingsCollapsed}. */
    collapsedKey: BookCollapsedKey;
};

/**
 * Book in-reader section that toggles {@link BookReaderSettings.settingsCollapsed} itself.
 */
export const BookReaderSettingSection = ({
    collapsedKey,
    ...sectionProps
}: BookReaderSettingSectionProps): ReactElement => {
    const dispatch = useAppDispatch();
    const epubReaderSettings = useAppSelector(selectLiveBookReaderSettings);
    const isCollapsed = epubReaderSettings.settingsCollapsed[collapsedKey];
    return (
        <ReaderSettingSection
            {...sectionProps}
            expanded={!isCollapsed}
            onToggle={() =>
                dispatch(
                    patchLiveBookReaderSettings({
                        settingsCollapsed: {
                            ...epubReaderSettings.settingsCollapsed,
                            [collapsedKey]: !isCollapsed,
                        },
                    }),
                )
            }
        />
    );
};
