import { useAppDispatch, useAppSelector } from "@store/hooks";
import { Fragment, type ReactElement, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { navigateToSetting } from "../utils/navigateToSetting";
import { keysFor, PRESET_SLOT_COMMANDS } from "../utils/usageKeys";

type SettingsLinkProps = {
    /** Opaque catalog id (see settingsTargets). */
    targetId: string;
    /** Optional DOM id on the anchor (Usage section anchors). */
    id?: string;
    children?: ReactNode;
};

/** In-app deep link that opens Settings (if needed) and navigates to a catalog target. */
const SettingsLink = ({ targetId, id, children }: SettingsLinkProps): ReactElement => {
    const dispatch = useAppDispatch();
    return (
        <a id={id} onClick={() => navigateToSetting(targetId, dispatch)}>
            {children}
        </a>
    );
};

/**
 * Settings Usage tab: a React skeleton whose copy comes from the `usage` namespace.
 * Prose lives in structured keys; `Trans` fills mid-sentence markup and live shortcut
 * / path values, so packs translate wording without shipping raw HTML.
 */
const Usage = (): ReactElement => {
    const { t, ready } = useTranslation("usage");
    const shortcuts = useAppSelector((store) => store.shortcuts);

    if (!ready) return <div className="content2 features" />;

    const sep = window.path.sep;
    const defaultMangaPath = process.platform === "win32" ? "D:\\manga" : "/home/manga";

    return (
        <div className="content2 features">
            <ul>
                <li>{t("defaultLocation")}</li>
                <li>
                    <b>{t("fileArrangement.title")}</b> {t("fileArrangement.body")}
                    <ul className="fileExample">
                        <li>
                            DEFAULT LOCATION\
                            <ul>
                                <li>
                                    One Piece\
                                    <ul>
                                        <li>
                                            Chapter 1\ <code>{t("fileArrangement.useOpenHere")}</code>
                                            <ul>
                                                <li>001.png</li>
                                                <li>002.png</li>
                                                <li>003.png</li>
                                                <li>004.png</li>
                                            </ul>
                                        </li>
                                        <li>
                                            Chapter 2\
                                            <ul>
                                                <li>001.png</li>
                                            </ul>
                                        </li>
                                        <li>Chapter 3.cbz</li>
                                        <li>Chapter 4.pdf</li>
                                    </ul>
                                </li>
                                <li>
                                    Bleach\
                                    <ul>
                                        <li>
                                            Chapter 1\ <code>{t("fileArrangement.useOpenHere")}</code>
                                            <ul>
                                                <li>001.png</li>
                                            </ul>
                                        </li>
                                        <li>Chapter 2.zip</li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </li>
                <li>
                    {t("dragDrop.title")}
                    <ul>
                        <li>{t("dragDrop.folder")}</li>
                        <li>{t("dragDrop.image")}</li>
                        <li>{t("dragDrop.archive")}</li>
                    </ul>
                </li>
                <li id="settings-usage-searchShortcutKeys">
                    {t("searchShortcuts.title")}
                    <ul>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.navigate"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{
                                    down: keysFor(shortcuts, "listDown"),
                                    up: keysFor(shortcuts, "listUp"),
                                }}
                            />
                        </li>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.selectFocused"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ select: keysFor(shortcuts, "listSelect") }}
                            />
                        </li>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.selectSingle"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ select: keysFor(shortcuts, "listSelect") }}
                            />
                        </li>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.selectEmpty"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ select: keysFor(shortcuts, "listSelect") }}
                            />
                        </li>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.dirUp"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ up: keysFor(shortcuts, "dirUp") }}
                            />
                        </li>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.contextMenu"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ menu: keysFor(shortcuts, "contextMenu") }}
                            />
                        </li>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.focusPageSearch"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ focus: keysFor(shortcuts, "focusPageSearch") }}
                            />
                        </li>
                        <li>
                            <Trans
                                i18nKey="searchShortcuts.settingsJump"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ focus: keysFor(shortcuts, "focusPageSearch") }}
                            />
                        </li>
                        <li>
                            <Trans i18nKey="searchShortcuts.byType" ns="usage" components={{ code: <code /> }} />
                        </li>
                    </ul>
                </li>
                <li id="settings-usage-language">
                    <b>{t("language.title")}</b>{" "}
                    <Trans i18nKey="language.body" ns="usage" components={{ bold: <b />, code: <code /> }} />
                </li>
                <li id="settings-usage-dbBackup">
                    <b>{t("dbBackup.title")}</b>{" "}
                    <Trans
                        i18nKey="dbBackup.body"
                        ns="usage"
                        components={{
                            bold: <b />,
                            code: <code />,
                            link: <SettingsLink targetId="setting:db-backup" />,
                        }}
                    />
                </li>
                <li>
                    <b>{t("homeLocation.title")}</b>
                    <ul>
                        <li>{t("homeLocation.clickItem")}</li>
                        <li>
                            <SettingsLink
                                id="settings-usage-openDirectlyFromManga"
                                targetId="setting:open-directly-from-manga"
                            >
                                {t("homeLocation.openDirectly.link")}
                            </SettingsLink>
                            <br />
                            <Trans
                                i18nKey="homeLocation.openDirectly.example"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ path: defaultMangaPath }}
                            />
                        </li>
                        <li>
                            <b>{t("homeLocation.search.title")}</b>
                            <ul>
                                <li>{t("homeLocation.search.symlink")}</li>
                                <li>
                                    <Trans
                                        i18nKey="homeLocation.search.partial"
                                        ns="usage"
                                        components={{ code: <code /> }}
                                    />
                                </li>
                                <li>
                                    <Trans
                                        i18nKey="homeLocation.search.exact"
                                        ns="usage"
                                        components={{ code: <code /> }}
                                    />
                                </li>
                                <li>{t("homeLocation.search.paste")}</li>
                                <li>
                                    <Trans
                                        i18nKey="homeLocation.search.goUp"
                                        ns="usage"
                                        components={{ code: <code /> }}
                                        values={{ sep }}
                                    />
                                </li>
                                {process.platform === "win32" && (
                                    <li>
                                        <Trans
                                            i18nKey="homeLocation.search.dDrive"
                                            ns="usage"
                                            components={{ code: <code /> }}
                                        />
                                    </li>
                                )}
                                <li>
                                    <Trans
                                        i18nKey="homeLocation.search.openInSearch"
                                        ns="usage"
                                        components={{ code: <code /> }}
                                        values={{ sep }}
                                    />
                                </li>
                            </ul>
                        </li>
                    </ul>
                </li>
                <li>{t("collapseTabs")}</li>
                <li>
                    <b>{t("gallery.title")}</b>{" "}
                    <Trans i18nKey="gallery.body" ns="usage" components={{ bold: <b /> }} />
                </li>
                <li>
                    <b>{t("galleryToolbar.title")}</b>{" "}
                    <Trans i18nKey="galleryToolbar.body" ns="usage" components={{ bold: <b /> }} />
                    <ul>
                        <li>
                            <Trans i18nKey="galleryToolbar.types" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans i18nKey="galleryToolbar.continue" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans i18nKey="galleryToolbar.library" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans i18nKey="galleryToolbar.bookmarks" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans i18nKey="galleryToolbar.favourites" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans i18nKey="galleryToolbar.clear" ns="usage" components={{ bold: <b /> }} />
                        </li>
                    </ul>
                </li>
                <li>
                    <b>{t("multiSelect.title")}</b>{" "}
                    <Trans
                        i18nKey="multiSelect.body"
                        ns="usage"
                        components={{
                            bold: <b />,
                            italic: <i />,
                            code: <code />,
                            link: <SettingsLink targetId="setting:classic-list-checkboxes" />,
                        }}
                    />
                </li>
                <li>
                    <b>{t("covers.title")}</b>{" "}
                    <Trans
                        i18nKey="covers.body"
                        ns="usage"
                        components={{
                            bold: <b />,
                            code: <code />,
                            link: <SettingsLink id="settings-usage-library" targetId="setting:library" />,
                        }}
                        values={{ libraryId: "<library id>.webp" }}
                    />
                </li>
                <li>
                    <b>{t("reader.title")}</b>
                    <ul>
                        <li>
                            <Trans
                                i18nKey="reader.verticalScroll"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{
                                    prev: keysFor(shortcuts, "prevPage"),
                                    next: keysFor(shortcuts, "nextPage"),
                                }}
                            />
                            <ul>
                                <li>{t("reader.leftPrev")}</li>
                                <li>{t("reader.rightNext")}</li>
                                <li>{t("reader.maxWidth")}</li>
                            </ul>
                        </li>{" "}
                        <li>{t("reader.mouseScroll")}</li>
                        <li>{t("reader.middleMouse")}</li>
                        <li>{t("reader.sideList")}</li>
                        <li>
                            <Trans
                                i18nKey="reader.sideListSearch"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{
                                    focus: keysFor(shortcuts, "focusPageSearch"),
                                    random: keysFor(shortcuts, "randomChapter"),
                                }}
                            />
                        </li>
                        <li>
                            <b>{t("reader.shuffle.title")}</b> {t("reader.shuffle.body")}
                        </li>
                        <li>
                            <b>{t("reader.sidelistSearch2.title")}</b> {t("reader.sidelistSearch2.body")}
                        </li>
                        <li>
                            <Trans
                                i18nKey="reader.zenMode"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ zen: keysFor(shortcuts, "toggleZenMode") }}
                            />
                        </li>
                        <li>
                            {t("reader.doubleClick")}
                            <ul>
                                <li>{t("reader.zen.vertical")}</li>
                                <li>{t("reader.zen.verticalEnds")}</li>
                                <li>{t("reader.zen.ltrRtl")}</li>
                            </ul>
                        </li>
                    </ul>
                </li>
                <li>
                    <Trans
                        i18nKey="fileExplorer.intro"
                        ns="usage"
                        components={{
                            link: <SettingsLink targetId="setting:file-explorer" />,
                        }}
                    />
                    <ul>
                        <li>{t("fileExplorer.rightClick")}</li>
                        <li>{t("fileExplorer.note")}</li>
                    </ul>
                </li>
                <li>
                    <b>{t("tray.title")}</b>{" "}
                    <Trans
                        i18nKey="tray.body"
                        ns="usage"
                        components={{
                            bold: <b />,
                            link: <SettingsLink targetId="setting:minimize-to-tray" />,
                        }}
                    />
                </li>
                <li>
                    <Trans
                        i18nKey="theme.body"
                        ns="usage"
                        components={{
                            link: <SettingsLink id="settings-usage-copyTheme" targetId="setting:copy-theme" />,
                        }}
                    />
                </li>
                <li id="settings-usage-readerPresets">
                    <b>{t("readerPresets.title")}</b> {t("readerPresets.body")}
                    <ul>
                        <li>
                            <b>{t("readerPresets.defaults.title")}</b> {t("readerPresets.defaults.body")}
                        </li>
                        <li>
                            <Trans i18nKey="readerPresets.select" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans i18nKey="readerPresets.reader" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans
                                i18nKey="readerPresets.savePreset"
                                ns="usage"
                                components={{ code: <code /> }}
                                values={{ save: keysFor(shortcuts, "savePreset") }}
                            />
                        </li>
                        <li>
                            <b>{t("readerPresets.keybinds.title")}</b>{" "}
                            <code>{keysFor(shortcuts, "cyclePresetNext")}</code> /{" "}
                            <code>{keysFor(shortcuts, "cyclePresetPrev")}</code>{" "}
                            {t("readerPresets.keybinds.cycle")}{" "}
                            {PRESET_SLOT_COMMANDS.map((c, idx) => {
                                const keys = keysFor(shortcuts, c);
                                return keys ? (
                                    <Fragment key={c}>
                                        <code>
                                            ({idx + 1}: {keys})
                                        </code>{" "}
                                        {idx < 4 ? ", " : ""}
                                    </Fragment>
                                ) : null;
                            }).filter(Boolean)}
                            {t("readerPresets.keybinds.slots")}
                        </li>
                        <li>
                            <b>{t("readerPresets.clipboard.title")}</b> {t("readerPresets.clipboard.body")}
                        </li>
                        <li>
                            <b>{t("readerPresets.exportImport.title")}</b> {t("readerPresets.exportImport.body")}
                        </li>
                        <li>
                            <b>{t("readerPresets.reset.title")}</b> {t("readerPresets.reset.body")}
                        </li>
                    </ul>
                </li>
                <li>
                    <SettingsLink id="settings-usage-pdfScale" targetId="setting:pdf">
                        <b>{t("pdfScale.link")}</b>
                    </SettingsLink>{" "}
                    {t("pdfScale.body")} <br />
                    <b>{t("pdfScale.warning")}</b>
                </li>
                <li id="settings-usage-anilist">
                    <b>{t("anilist.title")}</b>
                    <ul>
                        <li>{t("anilist.login")}</li>
                        <li>{t("anilist.managed")}</li>
                        <li>{t("anilist.autoUpdate")}</li>
                    </ul>
                </li>
                <li id="settings-usage-epubBackground">
                    <b>{t("epubBackground.title")}</b>{" "}
                    <Trans i18nKey="epubBackground.body" ns="usage" components={{ bold: <b /> }} />
                    <ul>
                        <li>
                            <Trans i18nKey="epubBackground.wallpaper" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans i18nKey="epubBackground.overlay" ns="usage" components={{ bold: <b /> }} />
                        </li>
                        <li>
                            <Trans
                                i18nKey="epubBackground.transparent"
                                ns="usage"
                                components={{ bold: <b />, code: <code /> }}
                            />
                        </li>
                        <li>
                            <Trans i18nKey="epubBackground.override" ns="usage" components={{ bold: <b /> }} />
                        </li>
                    </ul>
                </li>
                <li>
                    <Trans
                        i18nKey="about.body"
                        ns="usage"
                        components={{
                            bold: <b />,
                            link: <SettingsLink targetId="about" />,
                        }}
                    />
                </li>
                <li id="settings-usage-customStylesheet">
                    <Trans
                        i18nKey="customStylesheet.body"
                        ns="usage"
                        components={{
                            code: <code />,
                            link: <SettingsLink targetId="setting:custom-stylesheet" />,
                        }}
                    />
                    <br />
                    <Trans i18nKey="customStylesheet.note" ns="usage" components={{ code: <code /> }} />
                </li>
            </ul>
        </div>
    );
};

export default Usage;
