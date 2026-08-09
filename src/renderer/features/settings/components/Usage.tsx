import { useAppSelector } from "@store/hooks";
import { Fragment } from "react";
import { useSettingsContext } from "../Settings";

const Usage: React.FC = () => {
    const { scrollIntoView } = useSettingsContext();
    const shortcuts = useAppSelector((store) => store.shortcuts);

    return (
        <div className="content2 features">
            <ul>
                <li>
                    It is recommended to set {'"Default Location"'} to the folder where you usually store manga.
                </li>
                <li>
                    <b>Recommended File Arrangement:</b> Though you can open manga from anywhere, it is recommended
                    to arrange file in way as shown below for better experience and features like &quot;reader
                    side-list&quot;.
                    <ul className="fileExample">
                        <li>
                            DEFAULT LOCATION\
                            <ul>
                                <li>
                                    One Piece\
                                    <ul>
                                        <li>
                                            Chapter 1\ <code>use &quot;Open&quot; here</code>
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
                                            Chapter 1\ <code>use &quot;Open&quot; here</code>
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
                    Drag and Drop support.
                    <ul>
                        <li>Dropping a folder will open the reader with that folders content.</li>
                        <li>Dropping a supported image file will open its parent folder in the reader</li>
                        <li>Dropping archive or epub file will open them in the reader</li>
                    </ul>
                </li>
                <li id="settings-usage-searchShortcutKeys">
                    Search bar shortcut keys :
                    <ul>
                        <li>
                            With any search bar focused click{" "}
                            <code>{shortcuts.find((e) => e.command === "listDown")?.keys.join(", ")}</code> or{" "}
                            <code> {shortcuts.find((e) => e.command === "listUp")?.keys.join(", ")}</code> to
                            navigate through results.
                        </li>
                        <li>
                            Click <code>{shortcuts.find((e) => e.command === "listSelect")?.keys.join(", ")}</code>{" "}
                            (with item focused) to open.
                        </li>
                        <li>
                            Click <code>{shortcuts.find((e) => e.command === "listSelect")?.keys.join(", ")}</code>{" "}
                            (without item focused) if only one item in list to open.
                        </li>
                        <li>
                            Click <code>{shortcuts.find((e) => e.command === "listSelect")?.keys.join(", ")}</code>{" "}
                            on empty folder to open in reader.
                        </li>
                        <li>
                            Click <code>{shortcuts.find((e) => e.command === "dirUp")?.keys.join(", ")}</code> to
                            go up a directory/folder.
                        </li>
                        <li>
                            Click{" "}
                            <code>{shortcuts.find((e) => e.command === "contextMenu")?.keys.join(", ")}</code>{" "}
                            buttons to get right click menu of focused item.
                        </li>
                        <li>
                            Search by type: Type <code>manga|manhua|manhwa|webtoon|webcomic|comic</code> to search
                            for manga/manhua/manhwa/webtoon/webcomic/comic or <code>epub</code> for epub.
                        </li>
                    </ul>
                </li>
                <li>
                    <b>Home Location tab :</b>
                    <ul>
                        <li>
                            In location tab, click item to see its content or double-click (if enabled in settings
                            above) to open it in reader.
                        </li>
                        <li>
                            <a
                                id="settings-usage-openDirectlyFromManga"
                                onClick={() => {
                                    scrollIntoView("#settings-openDirectlyFromManga", "settings");
                                }}
                            >
                                Open chapter in reader directly if chapter is a sub-folder of sub-folder of
                                &quot;Default Location&quot;.
                            </a>
                            <br />
                            Example: If the default location is set to{" "}
                            {process.platform === "win32" ? <code>D:\manga</code> : <code>/home/manga</code>} and
                            there is a folder named <code>One Piece</code> within it, any sub-folder located
                            directly under <code>One Piece</code> will open automatically by clicking its link in
                            the home location list. If no images are found then the sub-folder will be opened in
                            location tab normally.
                        </li>
                        <li>
                            <b>Search:</b>
                            <ul>
                                <li>
                                    Symbolic links (symlinks) to directories are treated as directories in
                                    Locations/Home Location, so you can browse and open content through linked
                                    folders.
                                </li>
                                <li>
                                    You don&apos;t need to type the whole word in search. (e.g. For{" "}
                                    <code>One Piece</code> type <code>op</code>).
                                </li>
                                <li>
                                    For exact search, add <code>&quot;</code> or <code>`</code> in front of search.
                                    (e.g. For <code>One Piece</code> type <code>`one</code>).
                                </li>
                                <li>
                                    Paste link to set browse pasted link in Locations tab. Or page link of a
                                    supported file to open it in reader directly.
                                </li>
                                <li>
                                    Type <code>..{window.path.sep}</code> to go up directory.
                                </li>
                                {process.platform === "win32" ? (
                                    <li>
                                        Type let <code>D:\</code> to go to <code>D drive</code>.
                                    </li>
                                ) : (
                                    ""
                                )}
                                <li>
                                    Type name ending with <code>{window.path.sep}</code> to open it in search. e.g.
                                    When there is a directory named <code>One piece</code> in current list, type{" "}
                                    <code>One Piece{window.path.sep}</code> to open that as new list.
                                </li>
                            </ul>
                        </li>
                    </ul>
                </li>
                <li>
                    Collapse/Un-collapse Bookmarks, History page tabs by clicking on the Dividers beside them in
                    home screen.
                </li>
                <li>
                    <b>Gallery:</b> Click a book to open its details panel (bookmarks and notes from the reader;
                    click an entry to open the book at that place). Click manga for chapters and bookmarks as
                    before (empty image folders are hidden from the chapter list). Right-click a tile for{" "}
                    <b>Continue Reading</b>, <b>Show in File Explorer</b>, copy path, <b>Remove from Library</b>{" "}
                    (files on disk stay), and (with AniList connected) <b>Track with AniList</b>. In the details
                    panel, right-click the cover for the same library path actions; use the AniList bar under the
                    cover when logged in. If the library folder or EPUB is missing on disk, the details actions
                    area shows <b>Locate on disk</b> (re-link the path; warns if the name does not match) or{" "}
                    <b>Remove from Library</b> while cover, bookmarks, and notes stay visible. Classic History /
                    Bookmark rows use the same dialog when opening a missing path.
                </li>
                <li>
                    <b>Gallery toolbar:</b> One bar above the grid with section tabs (<b>Continue</b> /{" "}
                    <b>Library</b> / <b>Favourites</b>), a type filter (<b>All</b> / <b>Manga/Webcomic</b> /{" "}
                    <b>eBook</b>), search, sort, view mode (Cover + Title / Cover Only / Compact / List), and a
                    grid-size control that opens a slider for cover width.
                    <ul>
                        <li>
                            <b>Manga/Webcomic</b> covers every image-based series (manga, manhwa, manhua, comics,
                            webtoons); <b>eBook</b> covers EPUB files only, not PDF. Hover a segment for the full
                            list. The choice is remembered and applies to all three sections.
                        </li>
                        <li>
                            <b>Continue Reading</b> shows items with progress, sorted by last read by default.
                        </li>
                        <li>
                            <b>Library</b> shows everything; sort by title, date, or last read in either direction.
                        </li>
                        <li>
                            <b>Favourites</b> is reserved for a future favourites feature.
                        </li>
                        <li>
                            Search fields across the app show a small <b>x</b> button while they contain text;
                            click it to clear the filter.
                        </li>
                    </ul>
                </li>
                <li>
                    <b>Multi-select:</b> Tick the checkbox on a gallery tile, chapter, bookmark, or note to enter
                    selection mode. Hold <code>Shift</code> and click another item to select the range between
                    them. The toolbar swaps to show <b>Select All</b>, <b>Invert Selection</b> (gallery / details),
                    a 3-dot menu with bulk actions (e.g. <i>Copy Path</i>, <i>Bookmark</i>, <i>Remove Bookmark</i>,{" "}
                    <i>Remove from Library</i>, <i>Mark as Read/Unread</i>, <i>Delete Notes</i>), and a cancel
                    button. In gallery / details, use <code>Ctrl+A</code> (or <code>Cmd+A</code>) to select all and{" "}
                    <code>Esc</code> to clear — these shortcuts do not run while typing in a search field, and they
                    are not used on classic home lists. Classic Bookmark / History checkboxes can be toggled under{" "}
                    <a
                        onClick={() => {
                            scrollIntoView("#settings-classicListCheckboxes", "settings");
                        }}
                    >
                        <b>Other Settings</b>
                    </a>{" "}
                    (<i>Classic List Checkboxes</i>).
                </li>
                <li>
                    <b>Covers:</b> Generated thumbnails are saved under user data <code>covers</code> as{" "}
                    <code>&lt;library id&gt;.webp</code>. The gallery uses that file when present. If you use{" "}
                    <b>Select Cover</b> in the details panel, the app stores that image&apos;s absolute path on the
                    library entry and shows it when the file still exists; otherwise it falls back to the cached
                    WebP.{" "}
                    <a
                        id="settings-usage-library"
                        onClick={() => {
                            scrollIntoView("#settings-library", "settings");
                        }}
                    >
                        <b>Library</b>
                    </a>{" "}
                    in Settings can clear thumbnails, regenerate them, or bulk-import from your default folder.
                </li>
                <li>
                    <b>Reader :</b>
                    <ul>
                        <li>
                            When using the &quot;vertical Scroll&quot; mode, you can change chapters on the first
                            or last page by clicking on either side of the screen or by clicking
                            &quot;prevPage&quot; (
                            <code>{shortcuts.find((e) => e.command === "prevPage")?.keys.join(", ")}</code>) or
                            &quot;nextPage&quot; (
                            <code>{shortcuts.find((e) => e.command === "nextPage")?.keys.join(", ")}</code>)
                            shortcut keys. No response in center 20% of screen.
                            <ul>
                                <li>Left &nbsp;&nbsp;= Previous Chapter</li>
                                <li>Right = Next Chapter</li>
                                <li>
                                    Limit width of images in reader. To use &quot;Max Image Width&quot; feature,
                                    disable &quot;Size:Clamp&quot;.
                                </li>
                            </ul>
                        </li>{" "}
                        <li>
                            To scroll using mouse while viewing full page, use &quot;Left to Right&quot; or
                            &quot;Right to Left&quot; reading mode, then &quot;Fit Vertically&quot; option or make
                            image size lower than window height.
                        </li>
                        <li>Middle mouse button for auto scrolling.</li>
                        <li>
                            Access the side list by moving the mouse to left side of the screen. You can pin and
                            resize the side list.
                        </li>
                        <li>
                            <code>
                                {shortcuts.find((e) => e.command === "focusSideListSearch")?.keys.join(", ")}
                            </code>{" "}
                            focuses the sidelist chapter search.{" "}
                            <code>{shortcuts.find((e) => e.command === "randomChapter")?.keys.join(", ")}</code>{" "}
                            opens a random chapter (avoids recently opened; works with shuffle mode).
                        </li>
                        <li>
                            <b>Shuffle mode</b> (shuffle icon in sidelist): randomizes chapter order once;
                            prev/next follow shuffled order. Auto-refresh disabled in this mode. Session-only.
                        </li>
                        <li>
                            <b>Sidelist search:</b> When filter is active, prev/next and random use the filtered
                            list. Use the pin icon next to the search input to persist the filter when the list
                            refreshes (e.g. auto-refresh, manual Refresh).
                        </li>
                        <li>
                            Zen Mode (Full Screen Mode): Hides UI, Only shows images and page number if enabled.
                            Can be enabled using the shortcut key defined,{" "}
                            <code>{shortcuts.find((e) => e.command === "toggleZenMode")?.keys.join(", ")}</code>
                        </li>
                        <li>
                            Double click to toggle zen mode. Working area by reading mode:
                            <ul>
                                <li>Vertical Scroll - 100%</li>
                                <li>Vertical Scroll (chapter start/end) - center 60%</li>
                                <li>LTR and RTL - center 20%</li>
                            </ul>
                        </li>
                    </ul>
                </li>
                <li>
                    Open chapter directly from the file explorer after enabling{" "}
                    <a
                        onClick={() => {
                            scrollIntoView("#settings-fileExplorerOption", "settings");
                        }}
                    >
                        File Explorer Option
                    </a>
                    .
                    <ul>
                        <li>
                            Right Click on folder or .cbz/.7z/.zip/.pdf/.epub &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Show
                            more options (win11) &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Open in Yomikiru.
                        </li>
                        <li>Note that this only opens the chapter containing images, not the Manga Folder.</li>
                    </ul>
                </li>
                <li>
                    <b>Minimize to Tray:</b> Enable in{" "}
                    <a onClick={() => scrollIntoView("#settings-otherSettings", "settings")}>Other Settings</a> to
                    send the window to the system tray instead of the taskbar when minimizing. With one window,
                    left-click the tray icon to show or hide it; with multiple windows, left-click restores hidden
                    windows or focuses. Right-click for the window list, <b>Hide all Windows</b>, and Exit. Exit
                    respects &quot;Confirm Close Window&quot; when enabled.
                </li>
                <li>
                    <a
                        id="settings-usage-copyTheme"
                        onClick={() => {
                            scrollIntoView("#settings-copyTheme", "settings");
                        }}
                    >
                        Copy theme using &quot;Copy Current Theme to Clipboard&quot; under theme
                    </a>
                    , it will be copied as text and you can share it anywhere. To install the theme, copy whole
                    text you received and click on &quot;Save Theme from Clipboard&quot;.
                </li>
                <li id="settings-usage-readerPresets">
                    <b>Reader Presets:</b> Quick-switch between reading setups (e.g. 2-page LTR manga vs
                    vertical-scroll manhwa). Separate preset lists for manga and book (EPUB) readers.
                    <ul>
                        <li>
                            <b>Defaults:</b> Manga — Paged LTR, Long Strip, Long Strip with Gaps. Book — Default,
                            Continuous. On first run, a &quot;User&quot; preset per type is created with your
                            current settings.
                        </li>
                        <li>
                            <b>Select</b> applies a preset. <b>Delete</b> (trash icon) removes a custom preset; if
                            the deleted preset was selected, another preset is auto-selected. The &quot;User&quot;
                            preset cannot be removed.
                        </li>
                        <li>
                            In Reader Settings: <b>+</b> adds a new preset (name via modal). <b>Autosave</b>{" "}
                            toggle: when on, changes are saved into the selected preset automatically; off requires
                            manual Update or <b>savePreset</b> shortcut. User preset has autosave on by default.{" "}
                            <b>Save</b> (floppy icon) manually updates the selected preset.
                        </li>
                        <li>
                            <code>{shortcuts.find((e) => e.command === "savePreset")?.keys.join(", ")}</code> saves
                            current settings into the selected preset. Works even when the Reader Settings panel is
                            closed; feedback shows the preset name.
                        </li>
                        <li>
                            <b>Preset keybinds:</b>{" "}
                            <code>{shortcuts.find((e) => e.command === "cyclePresetNext")?.keys.join(", ")}</code>{" "}
                            /{" "}
                            <code>{shortcuts.find((e) => e.command === "cyclePresetPrev")?.keys.join(", ")}</code>{" "}
                            cycle to next/previous preset.{" "}
                            {["selectPreset1", "selectPreset2", "selectPreset3", "selectPreset4", "selectPreset5"]
                                .map((c, idx) => {
                                    const keys = shortcuts.find((e) => e.command === c)?.keys.join(", ");
                                    return keys ? (
                                        <Fragment key={c}>
                                            <code>
                                                ({idx + 1}: {keys})
                                            </code>{" "}
                                            {idx < 4 ? ", " : ""}
                                        </Fragment>
                                    ) : null;
                                })
                                .filter(Boolean)}
                            select preset 1-5 by display order. Slot keys are shared: in manga reader they select
                            manga presets, in EPUB reader they select book presets. Use up/down buttons to reorder
                            presets.
                        </li>
                        <li>
                            <b>Clipboard:</b> &quot;Copy Current Preset to Clipboard&quot; copies the selected
                            preset (from each Manga/Book section). &quot;Save Preset from Clipboard&quot; (top,
                            next to Reset) imports one preset; type is inferred from the JSON.
                        </li>
                        <li>
                            <b>Export/Import:</b> Per manga or book. Export saves custom presets only (defaults
                            excluded). Import from file for bulk transfer; duplicates by id are skipped.
                        </li>
                        <li>
                            <b>Reset to Default Presets</b> restores built-in presets to their original state; if a
                            &quot;User&quot; preset for manga or book is missing, it is recreated from your current
                            reader settings. Custom presets are kept.
                        </li>
                    </ul>
                </li>
                <li>
                    <a
                        id="settings-usage-pdfScale"
                        onClick={() => {
                            scrollIntoView("#settings-pdfScale", "settings");
                        }}
                    >
                        <b>PDF Scale:</b>
                    </a>{" "}
                    Set the quality of the images. Higher number means higher quality but also high initial cpu and
                    storage usage. <br />
                    <b>Do not use high scale with pdf which have high page count.</b>
                </li>
                <li id="settings-usage-anilist">
                    <b>AniList Tracking : </b>
                    <ul>
                        <li>
                            After logging in you can add tracking from the reader side list, the gallery details
                            panel (AniList bar), a gallery tile context menu, or the open manga side list.
                        </li>
                        <li>
                            Tracker are managed according to the folder of manga. If manga folder is
                            moved/renamed/deleted local tracker will be remove and user will need to add tracker
                            again.
                        </li>
                        <li>
                            Currently you need to manually update the progress entry but auto updating of tracker
                            will be supported soon.
                        </li>
                    </ul>
                </li>
                <li id="settings-usage-epubBackground">
                    <b>EPUB Reader Background:</b> While reading EPUB, open Reader Settings. In{" "}
                    <b>Styles &amp; Others</b>, <b>Page background color</b> is the canvas behind the column;{" "}
                    <b>Content background color</b> is the text column. Expand <b>Content frame</b> for{" "}
                    <b>Padding inline</b> and optional <b>Content border</b> (width, style, color). Expand the{" "}
                    <b>Background</b> section for wallpaper.
                    <ul>
                        <li>
                            Enable <b>Background image (wallpaper)</b>, select an image, then adjust dim intensity,
                            brightness, and contrast.
                        </li>
                        <li>
                            Optionally enable <b>Image layer overlay</b> and set its color and opacity.
                        </li>
                        <li>
                            To make the text column transparent so the wallpaper shows through: set{" "}
                            <b>Content background color</b> to transparent (e.g. <code>rgba(0,0,0,0)</code>).
                        </li>
                        <li>
                            Some books ship strong text or background colors in their own CSS. Enable{" "}
                            <b>Override EPUB colors (when customized)</b> so your non-default font, link, page, and
                            content background colors win over the book&apos;s styles (same section as those
                            options).
                        </li>
                    </ul>
                </li>
                <li>
                    In{" "}
                    <a
                        onClick={() => {
                            scrollIntoView("#settings-about", "about");
                        }}
                    >
                        <b>About</b>
                    </a>
                    , use <b>Detailed Info</b> to view version, commit, build date, Electron/Node versions, and OS
                    details. Use <b>Copy</b> to paste this info when reporting issues.
                </li>
                <li id="settings-usage-customStylesheet">
                    If you know how to write <code>.css</code>, you can customize style of app, more than just
                    theme color that is enabled by &quot;Theme Maker&quot;, by making your custom <code>.css</code>
                    file and adding it as{" "}
                    <a
                        onClick={() => {
                            scrollIntoView("#settings-customStylesheet", "settings");
                        }}
                    >
                        Custom Stylesheet
                    </a>
                    . You can use developer/inspect tool to check the element and existing styles.
                    <br />
                    NOTE: Do not move <code>&quot; .css &quot;</code> file in directly under app&apos;s folder. If
                    you are using portable version, everything except <code>userdata</code> folder will be deleted.
                    You can safely put it inside <code>userdata</code> folder.
                </li>
            </ul>
        </div>
    );
};

export default Usage;
