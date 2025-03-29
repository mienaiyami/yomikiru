import LocationListItem from "@features/home/LocationListItem";
import { faAngleUp, faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { formatUtils, promptSelectDir } from "@utils/file";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { ReactElement, useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useAppContext } from "src/renderer/App";
import { dialogUtils } from "@utils/dialog";
import ListNavigator from "../../components/ListNavigator";

type LocationData = { name: string; link: string; dateModified: number };

const LocationsTab = (): ReactElement => {
    const { openInReader, setContextMenuData } = useAppContext();
    const library = useAppSelector((store) => store.library.items);
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();

    //todo : use reducer instead and check if exists and is dir
    const [currentLink, setCurrentLink] = useState(window.path.resolve(appSettings.baseDir));
    const item = library[currentLink];

    const [locations, setLocations] = useState<LocationData[]>([]);
    const [isLoadingFile, setIsLoadingFile] = useState(true);
    const [imageCount, setImageCount] = useState(0);

    const locationContRef = useRef<HTMLDivElement>(null);

    const displayList = async (link = currentLink, refresh = false): Promise<void> => {
        try {
            if (!window.fs.existsSync(link)) {
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

    const filterLocation = useCallback((filter: string, location: LocationData) => {
        return new RegExp(filter, "ig").test(location.name);
    }, []);

    const renderLocationItem = useCallback(
        (location: LocationData, index: number, isSelected: boolean) => {
            return (
                <LocationListItem
                    name={location.name}
                    link={location.link}
                    focused={isSelected}
                    inHistory={
                        item?.type === "manga"
                            ? item.progress?.chaptersRead.includes(location.name) || false
                            : false
                    }
                    onContextMenu={onContextMenu}
                    key={location.link}
                    setCurrentLink={setCurrentLink}
                />
            );
        },
        [item, onContextMenu, setCurrentLink],
    );

    const handleContextMenu = useCallback((elem: HTMLElement) => {
        elem.dispatchEvent(window.contextMenu.fakeEvent(elem));
    }, []);

    const handleSelect = useCallback((elem: HTMLElement) => {
        elem.click();
    }, []);
    const handleKeyDown = useCallback((keyStr: string, shortcutsMapped: Record<ShortcutCommands, string[]>) => {
        if (shortcutsMapped["dirUp"].includes(keyStr)) {
            setCurrentLink((link) => window.path.dirname(link));
        }
    }, []);
    const handleOnChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            let val = e.target.value;
            // for changing drive in windows
            if (process.platform === "win32")
                if (/.:\\.*/.test(val)) {
                    const aa = window.path.normalize(val);
                    // opens directly if path is a file
                    if (window.fs.isFile(aa)) {
                        openInReader(aa);
                        return "";
                    }
                    setCurrentLink(aa);
                    return "";
                }
            // move up one directory
            if (val === ".." + window.path.sep) {
                setCurrentLink(window.path.resolve(currentLink, "../"));
                return "";
            }
            // check for exact match and open directly without enter
            if (val[val.length - 1] === window.path.sep) {
                const index = locations.findIndex(
                    (e) => e.name.toUpperCase() === val.replaceAll(window.path.sep, "").toUpperCase(),
                );
                if (index >= 0) {
                    const aa = window.path.normalize(locations[index].link);
                    if (window.fs.isFile(aa)) {
                        openInReader(aa);
                        return val;
                    }
                    setCurrentLink(aa);
                    return "";
                } else val = val.replaceAll(window.path.sep, "");
            }
            return val;
        },
        [currentLink, locations, openInReader, setCurrentLink],
    );

    return (
        <div className="contTab listCont" id="locationTab">
            <ListNavigator.Provider
                items={sortedLocations}
                filterFn={filterLocation}
                renderItem={renderLocationItem}
                onContextMenu={handleContextMenu}
                handleExtraKeyDown={handleKeyDown}
                onSelect={handleSelect}
                emptyMessage="No folders found"
            >
                <h2>Location</h2>
                <div className="tools">
                    <div className="row1">
                        <button
                            data-tooltip={
                                "Sort: " +
                                (appSettings.locationListSortType === "normal" ? "▲ " : "▼ ") +
                                appSettings.locationListSortBy.toUpperCase()
                            }
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
                            data-tooltip="Directory Up"
                            onClick={() => {
                                setCurrentLink((link) => window.path.dirname(link));
                            }}
                        >
                            <FontAwesomeIcon icon={faAngleUp} />
                        </button>
                        <ListNavigator.SearchInput runOriginalOnChange={true} onChange={handleOnChange} />
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
                </div>
                <div className="location-cont" ref={locationContRef}>
                    {isLoadingFile ? (
                        <p>Loading...</p>
                    ) : locations.length === 0 ? (
                        <p>0 Folders, {imageCount} Images</p>
                    ) : (
                        <ListNavigator.List />
                    )}
                </div>
            </ListNavigator.Provider>
        </div>
    );
};

export default LocationsTab;
