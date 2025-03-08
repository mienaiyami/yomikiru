import LocationListItem from "@features/home/LocationListItem";
import { faAngleUp, faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatUtils, promptSelectDir } from "@utils/file";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    ReactElement,
    useContext,
    useEffect,
    useRef,
    useState,
    useLayoutEffect,
    useMemo,
    useCallback,
} from "react";
import { useAppContext } from "src/renderer/App";
import { dialogUtils } from "@utils/dialog";
import { keyFormatter } from "@utils/keybindings";

type LocationData = { name: string; link: string; dateModified: number };

const LocationsTab = (): ReactElement => {
    const { openInReader, setContextMenuData } = useAppContext();
    const library = useAppSelector((store) => store.library.items);
    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const dispatch = useAppDispatch();

    //todo : use reducer instead and check if exists and is dir
    const [currentLink, setCurrentLink] = useState(window.path.resolve(appSettings.baseDir));
    const item = library[currentLink];

    const [locations, setLocations] = useState<LocationData[]>([]);
    const [isLoadingFile, setIsLoadingFile] = useState(true);
    const [filter, setFilter] = useState<string>("");
    const [imageCount, setImageCount] = useState(0);

    const [focused, setFocused] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const locationContRef = useRef<HTMLDivElement>(null);

    const displayList = async (link = currentLink, refresh = false): Promise<void> => {
        try {
            if (!refresh) {
                setFilter("");
                setFocused(-1);
            }
            if (!window.fs.existsSync(link)) {
                // todo: does it need to be here?
                if (!window.fs.existsSync(appSettings.baseDir)) {
                    dialogUtils.customError({ message: "Default Location doesn't exist." });
                    promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path as string })));
                    return;
                }
                dialogUtils.customError({ message: "Directory/File doesn't exist." });
                setCurrentLink(window.path.resolve(appSettings.baseDir));
                return;
            }

            if (window.fs.existsSync(link) && window.fs.isDir(link)) {
                if (!refresh) setIsLoadingFile(true);
                const files = await window.fs.readdir(link);
                let imgCount = 0;

                // order does not matter because it need to be sorted later
                const dirNames: typeof locations = [];
                //todo : test this
                await Promise.all(
                    files.map(async (fileName) => {
                        try {
                            const filePath = window.path.join(link, fileName);
                            // to prevent errors in case system files or no permissions or doesn't exist
                            await window.fs.access(filePath, window.fs.constants.R_OK);
                            const stat = await window.fs.stat(filePath);
                            if (stat.isFile && formatUtils.image.test(fileName)) {
                                imgCount++;
                                return;
                            }
                            if (stat.isDir || (stat.isFile && formatUtils.files.test(fileName))) {
                                dirNames.push({
                                    name: fileName,
                                    link: filePath,
                                    dateModified: stat.mtimeMs,
                                });
                            }
                        } catch (error) {
                            console.log(error);
                        }
                    }),
                );

                if (inputRef.current && !refresh) {
                    inputRef.current.value = "";
                }
                setImageCount(imgCount);
                setLocations(dirNames);
                setIsLoadingFile(false);
            }
        } catch (err) {
            if (err instanceof Error) {
                dialogUtils.nodeError(err);
            }
            window.logger.error(err);
        }
    };

    useEffect(() => {
        if (currentLink !== appSettings.baseDir) setCurrentLink(window.path.resolve(appSettings.baseDir));
    }, [appSettings.baseDir]);
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const refresh = () => {
            console.log("refresh");
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                displayList(currentLink, true);
            }, 1000);
        };
        const closeWatcher = window.chokidar.watch({
            path: currentLink,
            event: "all",
            options: {
                depth: 0,
                ignoreInitial: true,
            },
            callback: refresh,
        });
        displayList();
        return () => {
            closeWatcher();
        };
    }, [currentLink]);

    // todo move it to ref={}
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [inputRef]);

    const sortedLocations = useMemo(() => {
        const qq = formatUtils.files.getName;
        const sorted =
            appSettings.locationListSortBy === "name"
                ? locations.sort((a, b) => window.app.betterSortOrder(qq(a.name), qq(b.name)))
                : locations.sort((a, b) => (a.dateModified < b.dateModified ? -1 : 1));
        return appSettings.locationListSortType === "inverse" ? [...sorted].reverse() : sorted;
    }, [locations, appSettings.locationListSortBy, appSettings.locationListSortType]);

    const onContextMenu = useCallback(
        (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, link: string, inHistory: boolean) => {
            const items = [
                window.contextMenu.template.open(link),
                window.contextMenu.template.openInNewWindow(link),
            ];
            if (inHistory) {
                items.push(
                    window.contextMenu.template.unreadChapter(currentLink, formatUtils.files.getName(link)),
                );
                items.push(window.contextMenu.template.unreadAllChapter(currentLink));
            }
            items.push(window.contextMenu.template.showInExplorer(link));
            items.push(window.contextMenu.template.copyPath(link));
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.nativeEvent.relatedTarget,
            });
        },
        [currentLink],
    );

    return (
        <div className="contTab listCont" id="locationTab">
            <h2>Location</h2>
            <div className="tools">
                <div className="row1">
                    <button
                        data-tooltip={
                            "Sort: " +
                            (appSettings.locationListSortType === "normal" ? "▲ " : "▼ ") +
                            appSettings.locationListSortBy.toUpperCase()
                        }
                        // tabIndex={-1}
                        onClick={(e) => {
                            const items: Menu.ListItem[] = [
                                {
                                    label: "Name",
                                    action() {
                                        dispatch(
                                            setAppSettings({
                                                locationListSortBy: "name",
                                            }),
                                        );
                                    },
                                    selected: appSettings.locationListSortBy === "name",
                                },
                                {
                                    label: "Date Modified",
                                    action() {
                                        dispatch(
                                            setAppSettings({
                                                locationListSortBy: "date",
                                                locationListSortType: "inverse",
                                            }),
                                        );
                                    },
                                    selected: appSettings.locationListSortBy === "date",
                                },
                                window.contextMenu.template.divider(),
                                {
                                    label: "Ascending",
                                    action() {
                                        dispatch(
                                            setAppSettings({
                                                locationListSortType: "normal",
                                            }),
                                        );
                                    },
                                    selected: appSettings.locationListSortType === "normal",
                                },
                                {
                                    label: "Descending",
                                    action() {
                                        dispatch(
                                            setAppSettings({
                                                locationListSortType: "inverse",
                                            }),
                                        );
                                    },
                                    selected: appSettings.locationListSortType === "inverse",
                                },
                            ];
                            setContextMenuData({
                                clickX: e.currentTarget.getBoundingClientRect().x,
                                clickY: e.currentTarget.getBoundingClientRect().bottom + 4,
                                padLeft: true,
                                items,
                                focusBackElem: e.currentTarget,
                            });
                        }}
                    >
                        <FontAwesomeIcon icon={faSort} />
                    </button>
                    <button
                        // tabIndex={-1}
                        data-tooltip="Directory Up"
                        onClick={() => {
                            setCurrentLink((link) => window.path.dirname(link));
                        }}
                    >
                        <FontAwesomeIcon icon={faAngleUp} />
                    </button>
                    <input
                        type="text"
                        ref={inputRef}
                        id="locationInput"
                        placeholder="Type to Search"
                        spellCheck="false"
                        // tabIndex={-1}
                        onKeyDown={(e) => {
                            if (!e.ctrlKey) e.stopPropagation();
                            // if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                            //     e.preventDefault();
                            // }
                            if (/\*|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }

                            const keyStr = keyFormatter(e);
                            if (keyStr === "") return;
                            const shortcutsMapped = Object.fromEntries(
                                shortcuts.map((e) => [e.command, e.keys]),
                            ) as Record<ShortcutCommands, string[]>;

                            if (shortcutsMapped["dirUp"].includes(keyStr))
                                return setCurrentLink((link) => window.path.dirname(link));
                            switch (true) {
                                case shortcutsMapped["listDown"].includes(keyStr):
                                    e.preventDefault();
                                    setFocused((init) => {
                                        if (init + 1 >= locations.length) return 0;
                                        return init + 1;
                                    });
                                    break;
                                case shortcutsMapped["listUp"].includes(keyStr):
                                    e.preventDefault();
                                    setFocused((init) => {
                                        //todo fix: when searched, maybe move filter to sortedLocation
                                        if (init - 1 < 0) return locations.length - 1;
                                        return init - 1;
                                    });
                                    break;
                                case shortcutsMapped["contextMenu"].includes(keyStr): {
                                    const elem = locationContRef.current?.querySelector(
                                        '[data-focused="true"] a',
                                    ) as HTMLLIElement | null;
                                    if (elem) {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                        elem.dispatchEvent(window.contextMenu.fakeEvent(elem, inputRef.current));
                                    }
                                    break;
                                }
                                case shortcutsMapped["listSelect"].includes(keyStr): {
                                    if (locations.length === 0 && imageCount !== 0)
                                        return openInReader(currentLink);

                                    const elem = locationContRef.current?.querySelector(
                                        '[data-focused="true"] a',
                                    ) as HTMLLIElement | null;
                                    if (elem) return elem.click();
                                    const elems = locationContRef.current?.querySelectorAll("a");
                                    if (elems?.length === 1) elems[0].click();
                                    break;
                                }
                                default:
                                    break;
                            }
                        }}
                        onBlur={() => {
                            if (!document.activeElement?.classList.contains("contextMenu")) setFocused(-1);
                        }}
                        onContextMenu={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                        onChange={(e) => {
                            let val = e.target.value;

                            // for changing drive in windows
                            if (process.platform === "win32")
                                if (/.:\\.*/.test(val)) {
                                    const aa = window.path.normalize(val);
                                    // opens directly if path is a file
                                    if (window.fs.isFile(aa)) return openInReader(aa);
                                    setCurrentLink(aa);
                                    return;
                                }
                            // move up one directory
                            if (val === ".." + window.path.sep)
                                return setCurrentLink(window.path.resolve(currentLink, "../"));
                            // check for exact match and open directly without enter
                            if (val[val.length - 1] === window.path.sep) {
                                const index = locations.findIndex(
                                    (e) =>
                                        e.name.toUpperCase() === val.replaceAll(window.path.sep, "").toUpperCase(),
                                );
                                if (index >= 0) {
                                    const aa = window.path.normalize(locations[index].link);
                                    if (window.fs.isFile(aa)) return openInReader(aa);
                                    return setCurrentLink(aa);
                                    // need or not?
                                    // return setCurrentLink(window.path.normalize(locations[index].link + window.path.sep));
                                } else val = val.replaceAll(window.path.sep, "");
                            }

                            val = val.replaceAll("[", "\\[");
                            val = val.replaceAll("]", "\\]");
                            val = val.replaceAll("(", "\\(");
                            val = val.replaceAll(")", "\\)");
                            val = val.replaceAll("*", "\\-");
                            val = val.replaceAll("+", "\\+");

                            let filter = "";
                            if (['"', "`", "'"].includes(val[0])) {
                                filter = "^" + val.replaceAll(/('|"|`)/g, "");
                            } else
                                for (let i = 0; i < val.length; i++) {
                                    if (val[i] === window.path.sep) {
                                        filter += window.path.sep;
                                        continue;
                                    }
                                    filter += val[i] + ".*";
                                }
                            setFocused(-1);
                            setFilter(filter);
                        }}
                    />
                </div>
                <div className="currentPath">
                    <button
                        data-tooltip={`${imageCount} Images`}
                        disabled={imageCount <= 0}
                        onClick={() => openInReader(currentLink)}
                    >
                        Open
                    </button>
                    <span>{currentLink}</span>
                </div>
                {/* <span className="divider"></span> */}
                {/* <div className="imageCount">
                    <p>This folder contains {imageCount} Images.</p>
                </div> */}
                {/* <span className="divider"></span> */}
            </div>
            <div className="location-cont" ref={locationContRef}>
                {isLoadingFile ? (
                    <p>Loading...</p>
                ) : locations.length === 0 ? (
                    <p>0 Folders, {imageCount} Images</p>
                ) : (
                    <ol>
                        {sortedLocations
                            .filter((e) => new RegExp(filter, "ig") && new RegExp(filter, "ig").test(e.name))
                            .map(
                                (e, i, arr) =>
                                    new RegExp(filter, "ig") &&
                                    new RegExp(filter, "ig").test(e.name) && (
                                        <LocationListItem
                                            name={e.name}
                                            link={e.link}
                                            focused={focused >= 0 && focused % arr.length === i}
                                            // todo : improve history
                                            inHistory={
                                                item?.type === "manga"
                                                    ? item.progress?.chaptersRead.includes(e.name) || false
                                                    : false
                                            }
                                            onContextMenu={onContextMenu}
                                            key={e.link}
                                            setCurrentLink={setCurrentLink}
                                        />
                                    ),
                            )}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default LocationsTab;
