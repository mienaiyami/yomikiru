import { faAngleUp, faSort, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useRef, useState, useLayoutEffect, memo } from "react";
import { AppContext } from "../App";
import { setAppSettings } from "../store/appSettings";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import LocationListItem from "./LocationListItem";
import { promptSelectDir } from "../MainImports";

type LocationData = { name: string; link: string };

const LocationsTab = (): ReactElement => {
    const { openInReader } = useContext(AppContext);
    const history = useAppSelector((store) => store.history);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();

    const [currentLink, setCurrentLink] = useState(window.path.resolve(appSettings.baseDir));

    const [locations, setLocations] = useState<LocationData[]>([]);
    const [isLoadingFile, setIsLoadingFile] = useState(true);
    const [filter, setFilter] = useState<string>("");
    const [imageCount, setImageCount] = useState(0);

    const [focused, setFocused] = useState(-1);
    // number is index of manga in history
    const [historySimple, setHistorySimple] = useState<[number, string[]]>([-1, []]);

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
                            window.supportedFormats.includes(window.path.extname(e).toLowerCase())
                        );
                    }).length
                );
                const dirNames = files
                    .reduce((arr: LocationData[], cur) => {
                        if (window.fs.existsSync(window.path.join(link, cur))) {
                            if (
                                window.fs.lstatSync(window.path.join(link, cur)).isDirectory() ||
                                [".zip", ".cbz", ".7z", ".epub", ".pdf"].includes(
                                    window.path.extname(cur).toLowerCase()
                                )
                            ) {
                                arr.push({
                                    name: window.fs.lstatSync(window.path.join(link, cur)).isFile()
                                        ? window.app.replaceExtension(cur)
                                        : cur,
                                    link: window.path.join(link, cur),
                                });
                            }
                        }
                        return arr;
                        //  return (window.fs.lstatSync(window.path.join(link, e)) || false).isDirectory()
                    }, [])
                    .sort((a, b) => window.app.betterSortOrder(a.name, b.name));
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
        watcher.on("all", (e) => {
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

    useEffect(() => {
        if (currentLink) {
            const historyIndex = history.findIndex(
                (e) =>
                    e.type === "image" &&
                    (e as MangaHistoryItem).data.mangaLink.toLowerCase() === currentLink.toLowerCase()
            );
            if (history[historyIndex])
                setHistorySimple([
                    historyIndex,
                    (history[historyIndex] as MangaHistoryItem).data.chaptersRead.map((e) =>
                        window.app.replaceExtension(e)
                    ),
                ]);
        }
    }, [history, currentLink]);
    return (
        <div className="contTab listCont" id="locationTab">
            <h2>Location</h2>
            <div className="tools">
                <div className="row1">
                    {/* <button
                        // tabIndex={-1}
                        data-tooltip="Refresh"
                        onClick={() => {
                            displayList();
                        }}
                    >
                        <FontAwesomeIcon icon={faSyncAlt} />
                    </button> */}
                    <button
                        data-tooltip="Sort"
                        // tabIndex={-1}
                        onClick={() => {
                            dispatch(
                                setAppSettings({
                                    locationListSortType:
                                        appSettings.locationListSortType === "inverse" ? "normal" : "inverse",
                                })
                            );
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
                            if (e.altKey && e.key === "ArrowUp")
                                return setCurrentLink((link) => window.path.dirname(link));
                            if ((e.ctrlKey && e.key === "/") || (e.shiftKey && e.key === "F10"))
                                e.key = "ContextMenu";
                            switch (e.key) {
                                case "ArrowDown":
                                    setFocused((init) => {
                                        if (init + 1 >= locations.length) return 0;
                                        return init + 1;
                                    });
                                    break;
                                case "ArrowUp":
                                    setFocused((init) => {
                                        if (init - 1 < 0) return locations.length - 1;
                                        return init - 1;
                                    });
                                    break;
                                case "ContextMenu": {
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
                                case "Enter": {
                                    if (locations.length === 0 && imageCount !== 0)
                                        return openInReader(currentLink);
                                    const elem = locationContRef.current?.querySelector(
                                        '[data-focused="true"] a'
                                    ) as HTMLLIElement | null;
                                    if (elem) elem.click();
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
                                    if (window.fs.existsSync(aa) && window.fs.lstatSync(aa).isFile())
                                        return openInReader(aa);
                                    setCurrentLink(aa);
                                    return;
                                }
                            if (val === ".." + window.path.sep)
                                return setCurrentLink(window.path.resolve(currentLink, "../"));
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
                            if (val[0] === '"') {
                                filter = "^" + val.replaceAll('"', "");
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
                        {(appSettings.locationListSortType === "inverse" ? [...locations].reverse() : locations)
                            .filter((e) => new RegExp(filter, "ig") && new RegExp(filter, "ig").test(e.name))
                            .map(
                                (e, i, arr) =>
                                    new RegExp(filter, "ig") &&
                                    new RegExp(filter, "ig").test(e.name) && (
                                        <LocationListItem
                                            name={e.name}
                                            link={e.link}
                                            focused={
                                                arr.length === 1 && document.activeElement === inputRef.current
                                                    ? true
                                                    : focused % arr.length === i
                                            }
                                            inHistory={[
                                                historySimple[0],
                                                historySimple[1].findIndex((a) => a === e.name),
                                            ]}
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
