import { useContext, useRef } from "react";
import { AppContext } from "../App";
import InfoOnHover from "./InfoOnHover";
import { MainContext } from "./Main";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
    const itemRef = useRef<HTMLLIElement>(null);
    return (
        <li ref={itemRef}>
            <a
                className="a-context"
                onClick={() => openInReader(props.link, props.page)}
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
            >
                <span className="text">
                    {(props.mangaName.length > 15 ? props.mangaName.substring(0, 15) + "..." : props.mangaName) +
                        " | " +
                        props.chapterName}
                </span>
            </a>
            <div className="infoWrapper">
                <InfoOnHover
                    item={{
                        chapterName: props.chapterName,
                        mangaName: props.mangaName,
                        pages: props.pages,
                        date: props.date || "",
                        page: props.page || 0,
                    }}
                    column={props.isBookmark ? 2 : 3}
                    y={itemRef.current?.getBoundingClientRect().y}
                />
            </div>
        </li>
    );
};

export default BookmarkHistoryListItem;
