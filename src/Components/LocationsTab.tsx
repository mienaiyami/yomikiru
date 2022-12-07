import { faAngleUp, faSort, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { forwardRef, ReactElement, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";
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
        const [locations, setLocations] = useState<string[]>([]);
        const [isLoadingFile, setIsLoadingFile] = useState(true);
        const [filter, setFilter] = useState<string>("");
        const [imageCount, setImageCount] = useState(0);
        const { appSettings, setAppSettings } = useContext(AppContext);
        const inputRef = useRef<HTMLInputElement>(null);
        const displayList = (): void => {
            setFilter("");
            if (!window.fs.existsSync(currentLink)) {
                window.dialog.customError({ message: "Directory/File doesn't exist." });
                return;
            }

            if (window.fs.existsSync(currentLink) && window.fs.lstatSync(currentLink).isDirectory()) {
                setIsLoadingFile(true);
                window.fs.readdir(currentLink, (err, files) => {
                    if (err) {
                        window.logger.error(err);
                        window.dialog.nodeError(err);
                        return;
                    }
                    setImageCount(
                        files.filter((e) => window.supportedFormats.includes(window.path.extname(e))).length
                    );
                    const dirNames: string[] = files
                        .filter((e) => {
                            try {
                                if (
                                    window.fs.lstatSync(window.path.join(currentLink, e)).isDirectory() ||
                                    [".zip", ".cbz"].includes(window.path.extname(e))
                                )
                                    return true;
                            } catch {
                                return false;
                            }
                            //  return (window.fs.lstatSync(window.path.join(currentLink, e)) || false).isDirectory()
                        })
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
                            inHistory={false}
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
                        onClick={() =>
                            setAppSettings((init) => {
                                switch (init.locationListSortType) {
                                    case "normal":
                                        init.locationListSortType = "inverse";
                                        break;
                                    case "inverse":
                                        init.locationListSortType = "normal";
                                        break;
                                    default:
                                        break;
                                }
                                return { ...init };
                            })
                        }
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
                                if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                    e.preventDefault();
                                }
                            }}
                            onChange={(e) => {
                                const val = e.target.value;
                                // val = val.replace("[", "\\[");
                                // val = val.replace("]", "\\]");
                                // val = val.replace("(", "\\(");
                                // val = val.replace(")", "\\)");
                                // val = val.replace("*", "\\*");
                                // val = val.replace("+", "\\+");
                                let filter = "";
                                for (let i = 0; i < val.length; i++) {
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
                            <p>This folder contain {imageCount} images</p>
                            <p>No Directory</p>
                        </>
                    ) : (
                        <>
                            <p>This folder contain {imageCount} images</p>
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
