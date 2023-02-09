import { useContext, useRef } from "react";
import { AppContext } from "../App";
import InfoOnHover from "./InfoOnHover";
import { MainContext } from "./Main";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
    const linkRef = useRef<HTMLAnchorElement>(null);
    return (
        <li>
            <a
                className="a-context"
                onClick={() => openInReader(props.link, props.page)}
                ref={linkRef}
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
            <InfoOnHover
                item={{
                    chapterName: props.chapterName,
                    mangaName: props.mangaName,
                    pages: props.pages,
                    date: props.date || "",
                    page: props.page || 0,
                }}
                column={props.isBookmark ? 2 : 3}
                y={linkRef.current?.getBoundingClientRect().y || 0}
            />
        </li>
    );
};

export default BookmarkHistoryListItem;
