import { faAngleUp, faSort } from "@fortawesome/free-solid-svg-icons";
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
            mangaPath: string;
            currentLink: string;
            setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
        },
        ref: React.ForwardedRef<HTMLDivElement>
    ): ReactElement => {
        const [locations, setLocations] = useState<string[]>([]);
        const [isLoadingFile, setIsLoadingFile] = useState(true);
        const [filter, setfilter] = useState<string>("");
        const { appSettings, setAppSettings } = useContext(AppContext);
        const inputRef = useRef<HTMLInputElement>(null);
        const displayList = (link: string): void => {
            if (window.fs.existsSync(link) && window.fs.lstatSync(link).isDirectory()) {
                setIsLoadingFile(true);
                window.fs.readdir(link, (err, files) => {
                    if (err) return console.error(err);
                    const dirNames: string[] = files.sort(window.app.betterSortOrder);
                    if (inputRef.current) {
                        inputRef.current.value = "";
                    }
                    setIsLoadingFile(false);
                    setLocations(dirNames);
                });
            }
        };
        useEffect(() => {
            displayList(currentLink);
            setfilter("");
        }, [currentLink]);
        const List = (locations: string[], filter: string) => {
            return locations.map((e) => {
                if (new RegExp(filter, "ig").test(e))
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
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
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
                <div className="tool">
                    <span className="currentPath">Current: {currentLink}</span>
                    <div className="cont">
                        <button
                            tabIndex={-1}
                            onFocus={(e) => e.currentTarget.blur()}
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
                            tabIndex={-1}
                            onChange={(e) => {
                                const val = e.target.value;
                                let filter = "";
                                for (let i = 0; i < val.length; i++) {
                                    filter += val[i] + ".*";
                                }
                                setfilter(filter);
                            }}
                        />
                    </div>
                </div>
                <div className="location-cont">
                    {isLoadingFile ? (
                        <p>Loading...</p>
                    ) : locations.length === 0 ? (
                        <p>No Items</p>
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
    }
);

export default LocationsTab;
