import { useContext } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader } = useContext(AppContext);
    const { showContextMenu, setInfoOnHover } = useContext(MainContext);
    let timeOutOnHover: NodeJS.Timeout;
    return (
        <li>
            <a
                className="a-context"
                onClick={() => openInReader(props.link)}
                onContextMenu={(e) => {
                    showContextMenu({
                        isBookmark: props.isBookmark || false,
                        isHistory: props.isHistory || false,
                        link: props.link,
                        item: props,
                        isFile: false,
                        e: e.nativeEvent,
                    });
                }}
                onMouseEnter={(e) => {
                    const target = e.currentTarget;
                    timeOutOnHover = setTimeout(() => {
                        setInfoOnHover({
                            item: {
                                chapterName: props.chapterName,
                                mangaName: props.mangaName,
                                pages: props.pages,
                                date: props.date || "",
                            },
                            column: props.isBookmark ? 2 : 3,
                            y: target.getBoundingClientRect().y,
                            // parent: props.isBookmark
                            //     ? "#bookmarksTab .location-cont"
                            //     : "#historyTab .location-cont",
                        });
                    }, 500);
                }}
                onMouseLeave={() => {
                    clearTimeout(timeOutOnHover);
                    setInfoOnHover(null);
                }}
            >
                <span className="text">
                    {(props.mangaName.length > 15 ? props.mangaName.substring(0, 15) + "..." : props.mangaName) +
                        " | " +
                        props.chapterName}
                </span>
            </a>
        </li>
    );
};

export default BookmarkHistoryListItem;
