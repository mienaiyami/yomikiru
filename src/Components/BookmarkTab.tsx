import { useState, useRef } from "react";
import { useAppSelector } from "../store/hooks";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const BookmarkTab = () => {
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const appSettings = useAppSelector((store) => store.appSettings);

    const [filter, setFilter] = useState<string>("");
    const [focused, setFocused] = useState(-1);
    const locationContRef = useRef<HTMLDivElement>(null);
    const realList = (bookmarkData: Manga_BookItem[], filter: string) => {
        return bookmarkData.filter((e) => {
            if (
                new RegExp(filter, "ig").test(
                    e.type === "image"
                        ? e.data.mangaName +
                              (window.app.isSupportedFormat(e.data.chapterName)
                                  ? `.${window.path.extname(e.data.chapterName)}`
                                  : "")
                        : e.data.title + ".epub"
                )
            ) {
                return true;
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
                                filter = "^" + val.replaceAll('"', "");
                            } else
                                for (let i = 0; i < val.length; i++) {
                                    filter += val[i] + ".*";
                                }
                            setFocused(-1);
                            setFilter(filter);
                        }}
                        onBlur={() => {
                            setFocused(-1);
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }
                            if (e.key === "Escape") {
                                e.currentTarget.blur();
                            }
                            if ((e.ctrlKey && e.key === "/") || (e.shiftKey && e.key === "F10"))
                                e.key = "ContextMenu";
                            switch (e.key) {
                                case "ContextMenu": {
                                    const elem = locationContRef.current?.querySelector(
                                        '[data-focused="true"] a'
                                    ) as HTMLLIElement | null;
                                    if (elem) {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                        elem.dispatchEvent(window.contextMenu.fakeEvent(elem, e.currentTarget));
                                    }
                                    break;
                                }
                                case "ArrowDown":
                                    setFocused((init) => {
                                        if (init + 1 >= bookmarks.length) return 0;
                                        return init + 1;
                                    });
                                    break;
                                case "ArrowUp":
                                    setFocused((init) => {
                                        if (init - 1 < 0) return bookmarks.length - 1;
                                        return init - 1;
                                    });
                                    break;
                                case "Enter": {
                                    const elem = locationContRef.current?.querySelector(
                                        '[data-focused="true"] a'
                                    ) as HTMLLIElement | null;
                                    if (elem) elem.click();
                                    break;
                                }
                                default:
                                    break;
                            }
                        }}
                    />
                </div>
            )}
            <div className="location-cont" ref={locationContRef}>
                {bookmarks.length === 0 ? (
                    <p>No Bookmarks...</p>
                ) : (
                    <ol>
                        {realList(bookmarks, filter).map((e, i, arr) => (
                            <BookmarkHistoryListItem
                                isHistory={false}
                                isBookmark={true}
                                focused={focused % arr.length === i}
                                index={i}
                                {...e}
                                key={e.data.link}
                            />
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default BookmarkTab;
