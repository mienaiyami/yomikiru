import { faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";
import ReaderSideListItem from "./ReaderSideListItem";

const ReaderSideList = () => {
    const { mangaInReader, history, setAppSettings, appSettings, setPrevNextChapter } = useContext(AppContext);
    const { isContextMenuOpen } = useContext(MainContext);
    const [chapterData, setChapterData] = useState<{ name: string; pages: number }[]>([]);
    const [filter, setfilter] = useState<string>("");
    const [isListOpen, setListOpen] = useState(false);
    const prevMangaRef = useRef<string>("");
    const [historySimple, sethistorySimple] = useState(history.map((e) => e.chapterName));
    const currentLinkInListRef = useRef<HTMLAnchorElement>(null);
    useEffect(() => {
        if (!isContextMenuOpen) setListOpen(false);
    }, [isContextMenuOpen]);
    useEffect(() => {
        sethistorySimple(history.map((e) => e.chapterName));
    }, [history]);

    const changePrevNext = () => {
        if (mangaInReader) {
            const listDataName = chapterData.map((e) => e.name);
            const dir = mangaInReader.link.replace(mangaInReader.chapterName, "");
            const prevIndex = listDataName.indexOf(mangaInReader.chapterName) - 1;
            const nextIndex = listDataName.indexOf(mangaInReader.chapterName) + 1;
            const prevCh = prevIndex < 0 ? "first" : dir + chapterData[prevIndex].name;
            const nextCh = nextIndex >= chapterData.length ? "last" : dir + chapterData[nextIndex].name;
            setPrevNextChapter({ prev: prevCh, next: nextCh });
        }
    };
    useEffect(() => {
        if (chapterData.length >= 0) changePrevNext();
    }, [chapterData]);
    useEffect(() => {
        if (mangaInReader) {
            if (prevMangaRef.current === mangaInReader.mangaName) {
                changePrevNext();
                return;
            }
            prevMangaRef.current = mangaInReader.mangaName;
            const fn = async () => {
                const dir = mangaInReader.link.replace(mangaInReader.chapterName, "");
                const supportedFormat = [".jpg", ".jpeg", ".png", ".webp", ".svg", ".apng", ".gif", "avif"];
                window.fs.readdir(dir, (err, files) => {
                    if (err) return console.error(err);
                    files.sort(window.app.betterSortOrder);
                    const listData: { name: string; pages: number }[] = [];
                    let validFile = 0;
                    let responseCompleted = 0;
                    files.forEach((e, i) => {
                        const path = dir + "\\" + e;
                        if (window.fs.lstatSync(path).isDirectory()) {
                            validFile++;
                            window.fs.promises
                                .readdir(path)
                                .then((data) => {
                                    responseCompleted++;
                                    data = data.filter((e) => supportedFormat.includes(window.path.extname(e)));
                                    if (data.length > 0) {
                                        listData.push({ name: e, pages: data.length });
                                    }
                                    if (responseCompleted >= validFile) {
                                        setChapterData(listData);
                                    }
                                })
                                .catch((err) => {
                                    console.error(err);
                                    responseCompleted++;
                                    if (responseCompleted >= validFile) {
                                        setChapterData(listData);
                                    }
                                });
                        }
                    });
                });
            };
            fn();
        }
    }, [mangaInReader]);
    const List = (chapterData: { name: string; pages: number }[], filter: string) => {
        return chapterData.map((e) => {
            if (new RegExp(filter, "ig").test(e.name))
                return mangaInReader?.chapterName === e.name ? (
                    <ReaderSideListItem
                        name={e.name}
                        alreadyRead={historySimple.includes(e.name)}
                        key={e.name}
                        pages={e.pages}
                        current={true}
                        ref={currentLinkInListRef}
                        realRef={currentLinkInListRef}
                        parentLink={mangaInReader ? mangaInReader.link.replace(mangaInReader.chapterName, "") : ""}
                    />
                ) : (
                    <ReaderSideListItem
                        name={e.name}
                        alreadyRead={historySimple.includes(e.name)}
                        key={e.name}
                        pages={e.pages}
                        current={false}
                        parentLink={mangaInReader ? mangaInReader.link.replace(mangaInReader.chapterName, "") : ""}
                    />
                );
        });
    };
    return (
        <div
            className={`currentMangaList listCont ${isListOpen ? "open" : ""}`}
            onMouseEnter={() => {
                if (!isListOpen) setListOpen(true);
            }}
            onMouseLeave={() => {
                if (!isContextMenuOpen) setListOpen(false);
            }}
        >
            <div className="tool">
                <div className="cont">
                    <input
                        type="text"
                        name=""
                        id="locationInput2"
                        spellCheck={false}
                        placeholder="Type to Search"
                        tabIndex={-1}
                        data-tooltip="Navigate To Page"
                        onChange={(e) => {
                            const val = e.target.value;
                            let filter = "";
                            for (let i = 0; i < val.length; i++) {
                                filter += val[i] + ".*";
                            }
                            setfilter(filter);
                        }}
                    />
                    <button
                        id="inverseSort2"
                        tabIndex={-1}
                        data-value="normal"
                        data-tooltip="Sort"
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
                </div>
            </div>
            <h1>
                Manga: <span className="mangaName">{mangaInReader?.mangaName}</span>
                <br />
                Chapter: <span className="chapterName">{mangaInReader?.chapterName}</span>
            </h1>
            <div className="location-cont">
                {chapterData.length <= 0 ? (
                    <p>Loading...</p>
                ) : (
                    <ol>
                        {appSettings.locationListSortType === "inverse"
                            ? List([...chapterData], filter).reverse()
                            : List(chapterData, filter)}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default ReaderSideList;
