import { faAngleUp, faSort, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { forwardRef, ReactElement, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import { setAppSettings } from "../store/appSettings";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import LocationListItem from "./LocationListItem";

const LocationsTab = forwardRef(
    (
        {
            currentLink,
            setCurrentLink,
        }: {
            currentLink: string;
            setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
        },
        ref: React.ForwardedRef<HTMLDivElement>
    ): ReactElement => {
        const { openInReader } = useContext(AppContext);
        const history = useAppSelector((store) => store.history);
        const appSettings = useAppSelector((store) => store.appSettings);
        const dispatch = useAppDispatch();

        const [locations, setLocations] = useState<string[]>([]);
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
                    const dirNames: string[] = files
                        .reduce((arr: string[], cur) => {
                            if (window.fs.existsSync(window.path.join(link, cur))) {
                                if (
                                    window.fs.lstatSync(window.path.join(link, cur)).isDirectory() ||
                                    [".zip", ".cbz"].includes(window.path.extname(cur))
                                ) {
                                    arr.push(window.app.replaceExtension(cur));
                                }
                            }
                            return arr;
                            //  return (window.fs.lstatSync(window.path.join(link, e)) || false).isDirectory()
                        }, [])
                        .sort(window.app.betterSortOrder);
                    if (inputRef.current) {
                        inputRef.current.value = "";
                    }
                    setIsLoadingFile(false);
                    setLocations(dirNames);
                });
            }
        };
        useEffect(() => {
            displayList();
        }, [currentLink]);
        const List = (locations: string[], filter: string) => {
            return locations.map((e) => {
                if (new RegExp(filter, "ig") && new RegExp(filter, "ig").test(e))
                    return (
                        <LocationListItem
                            name={e}
                            link={window.path.join(currentLink, e)}
                            inHistory={
                                history
                                    .find((e) => e.mangaLink.toLowerCase() === currentLink.toLowerCase())
                                    ?.chaptersRead.includes(e) ?? false
                            }
                            key={e}
                            setCurrentLink={setCurrentLink}
                        />
                    );
            });
        };
        return (
            <div className="contTab listCont" id="locationTab" ref={ref}>
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
                                e.stopPropagation();
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
                                if (/.:\\.*/.test(val)) {
                                    setCurrentLink(window.path.normalize(val + "\\"));
                                    return;
                                }
                                if (val === "..\\")
                                    return setCurrentLink(window.path.resolve(currentLink, "..\\"));
                                if (val[val.length - 1] === "\\")
                                    if (
                                        locations.find(
                                            (e) => e.toUpperCase() === val.replaceAll("\\", "").toUpperCase()
                                        )
                                    )
                                        return setCurrentLink(
                                            window.path.normalize(
                                                currentLink +
                                                    "\\" +
                                                    locations.find(
                                                        (e) =>
                                                            e.toUpperCase() ===
                                                            val.replaceAll("\\", "").toUpperCase()
                                                    ) +
                                                    "\\"
                                            )
                                        );
                                    else val = val.replaceAll("\\", "");

                                val = val.replaceAll("[", "\\[");
                                val = val.replaceAll("]", "\\]");
                                val = val.replaceAll("(", "\\(");
                                val = val.replaceAll(")", "\\)");
                                val = val.replaceAll("*", "\\-");
                                val = val.replaceAll("+", "\\+");
                                let filter = "";
                                for (let i = 0; i < val.length; i++) {
                                    if (val[i] === "\\") {
                                        filter += "\\";
                                        continue;
                                    }
                                    filter += val[i] + ".*";
                                }
                                setFilter(filter);
                            }}
                        />
                    </div>
                    <span className="currentPath">
                        <button onClick={() => openInReader(currentLink)}>Open</button>
                        {currentLink}
                    </span>
                </div>
                <div className="location-cont">
                    {isLoadingFile ? (
                        <p>Loading...</p>
                    ) : locations.length === 0 ? (
                        <>
                            <p>This folder contains {imageCount} images.</p>
                            <p>No Directories</p>
                        </>
                    ) : (
                        <>
                            <p>This folder contains {imageCount} images.</p>
                            <ol>
                                {appSettings.locationListSortType === "inverse"
                                    ? List([...locations].reverse(), filter)
                                    : List(locations, filter)}
                            </ol>
                        </>
                    )}
                </div>
            </div>
        );
    }
);

export default LocationsTab;
