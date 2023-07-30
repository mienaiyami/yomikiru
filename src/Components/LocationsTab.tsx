import { faAngleUp, faSort, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useRef, useState, useLayoutEffect } from "react";
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

    const [currentLink, setCurrentLink] = useState(appSettings.baseDir);

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
            setCurrentLink(appSettings.baseDir);
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
    useLayoutEffect(() => setCurrentLink(appSettings.baseDir), [appSettings.baseDir]);
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
    const realList = (locations: LocationData[], filter: string) => {
        return locations.reduce((prev, e) => {
            const historyIndex =
                (window.fs.existsSync(e.link) &&
                    window.fs.lstatSync(e.link).isFile() &&
                    window.path.extname(e.link).toLowerCase()) === ".epub"
                    ? -1
                    : history.findIndex(
                          (e) =>
                              e.type === "image" &&
                              (e as MangaHistoryItem).data.mangaLink.toLowerCase() === currentLink.toLowerCase()
                      );
            let historyChapterIndex = -1;
            if (historyIndex >= 0)
                historyChapterIndex = (history[historyIndex] as MangaHistoryItem).data.chaptersRead.findIndex(
                    (a) => a === e.link.split(window.path.sep).pop() || ""
                );
            if (new RegExp(filter, "ig") && new RegExp(filter, "ig").test(e.name))
                prev.push([e, historyIndex, historyChapterIndex]);
            return prev;
        }, [] as [LocationData, number, number][]);
    };
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
                        title="Type to Search"
                        data-tooltip="Type to Search"
                        // tabIndex={-1}
                        onKeyDown={(e) => {
                            if (!e.ctrlKey) e.stopPropagation();
                            // if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                            //     e.preventDefault();
                            // }
                            if (/\*|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }
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
                                case "Enter": {
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
                        {(appSettings.locationListSortType === "inverse"
                            ? realList([...locations].reverse(), filter)
                            : realList(locations, filter)
                        ).map(([e, historyIndex, historyChapterIndex], i, arr) => (
                            <LocationListItem
                                name={e.name}
                                link={e.link}
                                focused={focused % arr.length === i}
                                inHistory={[historyIndex, historyChapterIndex]}
                                key={e.link}
                                setCurrentLink={setCurrentLink}
                            />
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default LocationsTab;
