import LocationListItem from "@features/home/LocationListItem";
import { faAngleUp, faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { promptSelectDir } from "@renderer-utils/file";
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
import { AppContext } from "src/renderer/App";

type LocationData = { name: string; link: string; dateModified: number };

const LocationsTab = (): ReactElement => {
    const { openInReader, setContextMenuData } = useContext(AppContext);
    const library = useAppSelector((store) => store.library.items);
    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const dispatch = useAppDispatch();

    const [currentLink, setCurrentLink] = useState(window.path.resolve(appSettings.baseDir));
    const item = library[currentLink];

    const [locations, setLocations] = useState<LocationData[]>([]);
    const [isLoadingFile, setIsLoadingFile] = useState(true);
    const [filter, setFilter] = useState<string>("");
    const [imageCount, setImageCount] = useState(0);

    const [focused, setFocused] = useState(-1);

    const inputRef = useRef<HTMLInputElement>(null);
    const locationContRef = useRef<HTMLDivElement>(null);

    const displayList = (link = currentLink, refresh = false): void => {
        if (!refresh) {
            setFilter("");
            setFocused(-1);
        }
        if (!window.fs.existsSync(link)) {
            if (!window.fs.existsSync(appSettings.baseDir)) {
                window.dialog.customError({ message: "Default Location doesn't exist." });
                promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path as string })));
                return;
            }
            window.dialog.customError({ message: "Directory/File doesn't exist." });
            setCurrentLink(window.path.resolve(appSettings.baseDir));
            return;
        }

        if (window.fs.existsSync(link) && window.fs.lstatSync(link).isDirectory()) {
            if (!refresh) setIsLoadingFile(true);
            window.fs.readdir(link, (err, files) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                    return;
                }
                setImageCount(
                    files.filter((e) => {
                        let aa = true;
                        try {
                            window.fs.lstatSync(window.path.join(link, e));
                        } catch (err) {
                            aa = false;
                        }
                        return (
                            aa &&
                            window.path.extname(e).toLowerCase() !== ".sys" &&
                            window.fs.lstatSync(window.path.join(link, e)).isFile() &&
                            window.app.formats.image.test(e)
                        );
                    }).length
                );
                const dirNames = files.reduce((arr: LocationData[], cur) => {
                    try {
                        const stat = window.fs.lstatSync(window.path.join(link, cur));
                        if (window.fs.existsSync(window.path.join(link, cur))) {
                            if (
                                //todo use window.app.formats
                                stat.isDirectory() ||
                                [
                                    ".zip",
                                    ".cbz",
                                    ".rar",
                                    ".7z",
                                    ".epub",
                                    ".pdf",
                                    ".xhtml",
                                    ".html",
                                    ".txt",
                                ].includes(window.path.extname(cur).toLowerCase())
                            ) {
                                arr.push({
                                    name: cur,
                                    link: window.path.join(link, cur),
                                    dateModified: stat.mtimeMs,
                                });
                            }
                        }
                    } catch (err) {
                        console.error(err);
                    }
                    return arr;
                    //  return (window.fs.lstatSync(window.path.join(link, e)) || false).isDirectory()
                }, []);

                if (inputRef.current && !refresh) {
                    inputRef.current.value = "";
                }
                setLocations(dirNames);
                setIsLoadingFile(false);
            });
        }
    };

    useLayoutEffect(() => {
        if (currentLink !== appSettings.baseDir) setCurrentLink(window.path.resolve(appSettings.baseDir));
    }, [appSettings.baseDir]);
    useLayoutEffect(() => {
        const watcher = window.chokidar.watch(currentLink, {
            depth: 0,
            ignoreInitial: true,
        });
        displayList();
        let timeout: NodeJS.Timeout;
        const refresh = () => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                displayList(currentLink, true);
            }, 1000);
        };
        watcher.on("all", () => {
            refresh();
        });
        return () => {
            watcher.removeAllListeners("all");
        };
    }, [currentLink]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [inputRef]);

    const sortedLocations = useMemo(() => {
        const qq = window.app.formats.files.getName;
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
                    window.contextMenu.template.unreadChapter(currentLink, window.app.formats.files.getName(link))
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
        [currentLink]
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
                                            })
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
                                            })
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
                                            })
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
                                            })
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

                            const keyStr = window.keyFormatter(e);
                            if (keyStr === "") return;
                            const shortcutsMapped = Object.fromEntries(
                                shortcuts.map((e) => [e.command, e.keys])
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
                                        '[data-focused="true"] a'
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
                                        '[data-focused="true"] a'
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
                            // val = val.replaceAll('"', "");
                            if (process.platform === "win32")
                                if (/.:\\.*/.test(val)) {
                                    const aa = window.path.normalize(val);
                                    try {
                                        if (window.fs.existsSync(aa) && window.fs.lstatSync(aa).isFile())
                                            return openInReader(aa);
                                        setCurrentLink(aa);
                                    } catch (err) {
                                        console.error(err);
                                    }
                                    return;
                                }
                            if (val === ".." + window.path.sep)
                                return setCurrentLink(window.path.resolve(currentLink, "../"));
                            // check for exact match and open directly without enter
                            if (val[val.length - 1] === window.path.sep) {
                                const index = locations.findIndex(
                                    (e) =>
                                        e.name.toUpperCase() === val.replaceAll(window.path.sep, "").toUpperCase()
                                );
                                if (index >= 0) {
                                    const aa = window.path.normalize(locations[index].link);
                                    if (window.fs.existsSync(aa) && window.fs.lstatSync(aa).isFile())
                                        return openInReader(aa);
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
                                                    ? item.progress.chaptersRead.includes(e.name)
                                                    : false
                                            }
                                            onContextMenu={onContextMenu}
                                            key={e.link}
                                            setCurrentLink={setCurrentLink}
                                        />
                                    )
                            )}
                    </ol>
                )}
            </div>
        </div>
    );
};

// const RealList = memo(
//     ({
//         locations,
//         historySimple,
//         inputRef,
//         focused,setCurrentLink
//     }: {
//         locations: LocationData[]
//         historySimple: [number, string[]]
//         inputRef: React.RefObject<HTMLInputElement>;
//         focused: number;
//         setCurrentLink: React.Dispatch<React.SetStateAction<string>>
//     }) => {
//         return (
//         <ol>
//         {locations.map((e, i, arr) => (
//             <LocationListItem
//                 name={e.name}
//                 link={e.link}
//                 focused={
//                     arr.length === 1 && document.activeElement === inputRef.current
//                         ? true
//                         : focused % arr.length === i
//                 }
//                 inHistory={[historySimple[0], historySimple[1].findIndex((a) => a === e.name)]}
//                 key={e.link}
//                 setCurrentLink={setCurrentLink}
//             />
//         ))}
//             </ol>)
//     },
//     (prev, next) => {
//         (prev.inputRef.current===next.inputRef.current) && (prev.focused===next.focused)
//     }
// );

export default LocationsTab;
