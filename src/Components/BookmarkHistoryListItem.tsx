const BookmarkHistoryListItem = (props: ListItem) => {
    return (
        <li>
            <a
                className="a-context"
                // onclick="makeImg($(this).attr('data-link'))"
                // onmouseover="fileInfoOnHover($(this))"
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
