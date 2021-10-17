import { ReactElement } from "react";

const BookmarkTab = (): ReactElement => {
    return (
        <div className="contTab" id="bookmarksTab">
            <h2>Bookmarks</h2>
            <div className="location-cont">
                <ol></ol>
            </div>
        </div>
    );
};

export default BookmarkTab;
