import { useAppSelector } from "@store/hooks";
const Usage = ({
    scrollIntoView,
}: {
    scrollIntoView: (
        elementQuery: string,
        tab: "settings" | "shortcutKeys" | "makeTheme" | "about" | "extras",
    ) => void;
}) => {
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
                            After logging in successfully you can enable tracking by opening a manga and checking
                            side-list (moving mouse to left most part of app).
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
