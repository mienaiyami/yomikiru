import { ReactElement, useContext } from "react";
import { AppContext } from "../App";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const BookmarkTab = (): ReactElement => {
    const { bookmarks, appSettings } = useContext(AppContext);
    return (
        <div
            className="contTab listCont"
            style={{ display: appSettings.showTabs.bookmark ? "flex" : "none" }}
            id="bookmarksTab"
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
};

export default BookmarkTab;
