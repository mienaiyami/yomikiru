import { forwardRef, ReactElement, useContext } from "react";
import { AppContext } from "../App";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const BookmarkTab = forwardRef(
    (
        { bookmarkTabDisplay }: { bookmarkTabDisplay: boolean },
        ref: React.ForwardedRef<HTMLDivElement>
    ): ReactElement => {
        const { bookmarks, setBookmarks } = useContext(AppContext);

        return (
            <div
                className="contTab listCont"
                style={{ display: bookmarkTabDisplay ? "flex" : "none" }}
                id="bookmarksTab"
                ref={ref}
            >
                <h2>Bookmarks</h2>
                <div className="location-cont">
                    {bookmarks.length === 0 ? (
                        <p>No Bookmarks...</p>
                    ) : (
                        <ol>
                            {bookmarks.map((e, i) => (
                                <BookmarkHistoryListItem
                                    isHistory={false}
                                    isBookmark={true}
                                    index={i}
                                    {...e}
                                    key={e.link}
                                />
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        );
    }
);

export default BookmarkTab;
