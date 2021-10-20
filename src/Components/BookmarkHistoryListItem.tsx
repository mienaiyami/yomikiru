import { useContext, useState } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader } = useContext(AppContext);
    const { showContextMenu, setInfoOnHover } = useContext(MainContext);
    return (
        <li>
            <a
                className="a-context"
                onClick={() => openInReader(props.link)}
                onContextMenu={e => {
                    showContextMenu({
                        isBookmark: props.isBookmark || false,
                        isHistory: props.isHistory || false,
                        link: props.link,
                        item: props,
                        isFile: false,
                        e: e.nativeEvent,
                    });
                }}
                onMouseEnter={e => {
                    setInfoOnHover({
                        item: {
                            chapterName: props.chapterName,
                            mangaName: props.mangaName,
                            pages: props.pages,
                            date: props.date || "",
                        },
                        y: e.currentTarget.getBoundingClientRect().y,
                        parent: props.isBookmark ? "#bookmarksTab .location-cont" : "#historyTab .location-cont",
                    });
                }}
                onMouseLeave={() => setInfoOnHover(null)}
            >
                <span className="text">
                    {(props.mangaName.length > 30 ? props.mangaName.substr(0, 30) + "..." : props.mangaName) +
                        " | " +
                        props.chapterName}
                </span>
            </a>
        </li>
    );
};

export default BookmarkHistoryListItem;
