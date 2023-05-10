import { faAngleUp, faSort, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useRef, useState, useLayoutEffect } from "react";
import { AppContext } from "../App";
import { setAppSettings } from "../store/appSettings";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import LocationListItem from "./LocationListItem";

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
    const inputRef = useRef<HTMLInputElement>(null);
    const displayList = (link = currentLink): void => {
        setFilter("");
        if (!window.fs.existsSync(link)) {
            window.dialog.customError({ message: "Directory/File doesn't exist." });
            return;
        }

        if (window.fs.existsSync(link) && window.fs.lstatSync(link).isDirectory()) {
            setIsLoadingFile(true);
            window.fs.readdir(link, (err, files) => {
                if (err) {
                    window.logger.error(err);
                    window.dialog.nodeError(err);
                    return;
                }
                setImageCount(
                    files.filter((e) => window.supportedFormats.includes(window.path.extname(e).toLowerCase()))
                        .length
                );
                const dirNames = files
                    .reduce((arr: LocationData[], cur) => {
                        if (window.fs.existsSync(window.path.join(link, cur))) {
                            if (
                                window.fs.lstatSync(window.path.join(link, cur)).isDirectory() ||
                                [".zip", ".cbz", ".epub"].includes(window.path.extname(cur).toLowerCase())
                            ) {
                                arr.push({
                                    name: window.app.replaceExtension(cur),
                                    link: window.path.join(link, cur),
                                });
                            }
                        }
                        return arr;
                        //  return (window.fs.lstatSync(window.path.join(link, e)) || false).isDirectory()
                    }, [])
                    .sort((a, b) => window.app.betterSortOrder(a.name, b.name));
                if (inputRef.current) {
                    inputRef.current.value = "";
                }
                setIsLoadingFile(false);
                setLocations(dirNames);
            });
        }
    };
    useLayoutEffect(() => setCurrentLink(appSettings.baseDir), [appSettings.baseDir]);
    useEffect(() => {
        displayList();
    }, [currentLink]);
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [inputRef]);
    const List = (locations: LocationData[], filter: string) => {
        return locations.map((e) => {
            if (new RegExp(filter, "ig") && new RegExp(filter, "ig").test(e.name))
                return (
                    <LocationListItem
                        name={e.name}
                        link={e.link}
                        inHistory={
                            history
                                .find((e) => e.mangaLink.toLowerCase() === currentLink.toLowerCase())
                                ?.chaptersRead.includes(e.link.split(window.path.sep).pop() || "") ?? false
                        }
                        key={e.link}
                        setCurrentLink={setCurrentLink}
                    />
                );
        });
    };
    return (
        <div className="contTab listCont" id="locationTab">
            <h2>
                Location
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
            </h2>
            <div className="tools">
                <div className="row1">
                    <button
                        // tabIndex={-1}
                        data-tooltip="Refresh"
                        onClick={() => {
                            displayList();
                        }}
                    >
                        <FontAwesomeIcon icon={faSyncAlt} />
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
                        }}
                        onChange={(e) => {
                            let val = e.target.value;
                            val = val.replaceAll('"', "");
                            if (process.platform === "win32")
                                if (/.:\\.*/.test(val)) {
                                    setCurrentLink(window.path.normalize(val + window.path.sep));
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
                                    return setCurrentLink(window.path.normalize(locations[index].link));
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
                            for (let i = 0; i < val.length; i++) {
                                if (val[i] === window.path.sep) {
                                    filter += window.path.sep;
                                    continue;
                                }
                                filter += val[i] + ".*";
                            }
                            setFilter(filter);
                        }}
                    />
                </div>
                <div className="currentPath">
                    <button
                        data-tooltip={`This folder contains ${imageCount} images`}
                        disabled={imageCount <= 0}
                        onClick={() => openInReader(currentLink)}
                    >
                        Open
                    </button>
                    {currentLink}
                </div>
                {/* <span className="divider"></span> */}
                {/* <div className="imageCount">
                    <p>This folder contains {imageCount} images.</p>
                </div> */}
                {/* <span className="divider"></span> */}
            </div>
            <div className="location-cont">
                {isLoadingFile ? (
                    <p>Loading...</p>
                ) : locations.length === 0 ? (
                    <p>No Directories</p>
                ) : (
                    <ol>
                        {appSettings.locationListSortType === "inverse"
                            ? List([...locations].reverse(), filter)
                            : List(locations, filter)}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default LocationsTab;
