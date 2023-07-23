import { useState } from "react";
import { useAppSelector } from "../store/hooks";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const BookmarkTab = () => {
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const appSettings = useAppSelector((store) => store.appSettings);

    const [filter, setFilter] = useState<string>("");
    const List = (bookmarkData: Manga_BookItem[], filter: string) => {
        return bookmarkData.map((e, i) => {
            if (
                new RegExp(filter, "ig").test(
                    (e.type === "image"
                        ? window.fs.existsSync(e.data.link) && window.fs.lstatSync(e.data.link).isDirectory()
                            ? window.path.dirname(e.data.link)
                            : e.data.link
                        : e.data.link
                    )
                        .split(window.path.sep)
                        .at(-1) || ""
                )
            ) {
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
            className={"contTab listCont " + (!appSettings.showTabs.bookmark ? "collapsed " : "")}
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
                            if (val[0] === '"') {
                                filter = val.replaceAll('"', "");
                            } else
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
