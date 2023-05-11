import { useState } from "react";
import { useAppSelector } from "../store/hooks";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const BookmarkTab = () => {
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const appSettings = useAppSelector((store) => store.appSettings);

    const [filter, setFilter] = useState<string>("");
    const List = (bookmarkData: Manga_BookItem[], filter: string) => {
        return bookmarkData.map((e, i) => {
            if (new RegExp(filter, "ig").test(e.type === "book" ? e.data.title : e.data.mangaName)) {
                return (
                    <BookmarkHistoryListItem
                        isHistory={false}
                        isBookmark={true}
                        index={i}
                        {...e}
                        key={e.data.link}
                    />
                );
            }
        });
    };

    return (
        <div
            className="contTab listCont"
            style={{ display: appSettings.showTabs.bookmark ? "flex" : "none" }}
            id="bookmarksTab"
        >
            <h2>Bookmarks</h2>
            {appSettings.showSearch && (
                <div className="tools">
                    <input
                        type="text"
                        name=""
                        spellCheck={false}
                        placeholder="Type to Search"
                        // tabIndex={-1}
                        onChange={(e) => {
                            const val = e.target.value;
                            let filter = "";
                            for (let i = 0; i < val.length; i++) {
                                filter += val[i] + ".*";
                            }
                            setFilter(filter);
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }
                            if (e.key === "Escape") {
                                e.currentTarget.blur();
                            }
                        }}
                    />
                </div>
            )}
            <div className="location-cont">
                {bookmarks.length === 0 ? <p>No Bookmarks...</p> : <ol>{List(bookmarks, filter)}</ol>}
            </div>
        </div>
    );
};

export default BookmarkTab;
