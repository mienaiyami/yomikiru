import { useContext, useState, useEffect } from "react";
import { AppContext } from "../App";
// import { setContextMenu } from "../store/contextMenu";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader, setContextMenuData, contextMenuData } = useContext(AppContext);
    const appSettings = useAppSelector((store) => store.appSettings);
    const [contextMenuFocused, setContextMenuFocused] = useState(false);
    useEffect(() => {
        if (!contextMenuData) setContextMenuFocused(false);
    }, [contextMenuData]);
    // const dispatch = useAppDispatch();
    // const [pos, setPos] = useState({ x: 0, y: 0 });
    // const infoRef = useRef<HTMLDivElement>(null);
    // const InfoOnHover = () => {
    //     return (
    //         <div className="infoOnHover" ref={infoRef} style={{ top: pos.y + "px" }}>
    //             <div className="info-cont">
    //                 <div className="title">Manga</div>
    //                 <div className="info">{props.mangaName}</div>
    //             </div>
    //             <div className="info-cont">
    //                 <div className="title">Chapter</div>
    //                 <div className="info">{props.chapterName}</div>
    //             </div>
    //             <div className="info-cont">
    //                 <div className="title">Pages</div>
    //                 <div className="info">{props.pages}</div>
    //             </div>
    //             <div className="info-cont">
    //                 <div className="title">Page</div>
    //                 <div className="info">{props.page}</div>
    //             </div>
    //             <div className="info-cont">
    //                 <div className="title">Date</div>
    //                 <div className="info">{props.date}</div>
    //             </div>
    //         </div>
    //     );
    // };
    const title =
        props.type === "book"
            ? `Title       : ${props.data.title}\n` +
              `Chapter : ${props.data.chapter || "~"}\n` +
              `Date      : ${props.data.date}\n` +
              `Path      : ${props.data.link}`
            : `Manga   : ${props.data.mangaName}\n` +
              `Chapter : ${props.data.chapterName}\n` +
              `Pages    : ${props.data.pages}\n` +
              `Page      : ${props.data.page || 1}\n` +
              `Date      : ${props.data.date}\n` +
              `Path      : ${props.data.link}`;

    return (
        <li
            {...(appSettings.showMoreDataOnItemHover ? { title } : {})}
            className={`${contextMenuFocused ? "focused" : ""}`}
            data-focused={props.focused}
            ref={(node) => {
                if (node && props.focused) node.scrollIntoView({ block: "nearest" });
            }}
            // onMouseOver={(e) => {
            //     let y = e.currentTarget.getBoundingClientRect().top;
            //     // console.log(e.currentTarget.getBoundingClientRect().top);
            //     if (infoRef.current)
            //         if (y > window.innerHeight - infoRef.current.offsetHeight - 20) {
            //             y = window.innerHeight - infoRef.current.offsetHeight - 20;
            //         }
            //     setPos({ x: e.currentTarget.offsetTop, y });
            // }}
        >
            <a
                className="big"
                onClick={() => {
                    if (!window.fs.existsSync(props.data.link)) {
                        window.dialog.customError({
                            message: "File/folder does not exit.",
                        });
                        return;
                    }
                    openInReader(
                        props.data.link,
                        props.type === "image" ? props.data.page : props.data.chapter || "",
                        props.type === "book" ? props.data.elementQueryString : ""
                    );
                }}
                onContextMenu={(e) => {
                    const items = [
                        window.contextMenu.template.open(props.data.link),
                        window.contextMenu.template.openInNewWindow(props.data.link),
                        window.contextMenu.template.showInExplorer(props.data.link),
                    ];
                    if (props.isBookmark) items.push(window.contextMenu.template.removeBookmark(props.data.link));
                    else items.push(window.contextMenu.template.addToBookmark(props));
                    if (props.isHistory) items.push(window.contextMenu.template.removeHistory(props.index));

                    setContextMenuFocused(true);
                    // dispatch(
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        focusBackElem: e.nativeEvent.relatedTarget,
                        items,
                    });
                    // );
                    // showContextMenu({
                    //     isBookmark: props.isBookmark || false,
                    //     isHistory: props.isHistory || false,
                    //     link: props.link,
                    //     item: props,
                    //     isFile: false,
                    //     e: e.nativeEvent,
                    // });
                }}
            >
                {props.type === "book" ? (
                    <span className="double">
                        <span className="text">{props.data.title}</span>
                        <span className="text chapter">
                            <span className="text">{props.data.chapter || "~"}</span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                {/* EPUB
                                <span className="num"></span> */}
                                <code className="nonFolder">EPUB</code>
                            </span>
                        </span>
                    </span>
                ) : (
                    <span className="double">
                        <span className="text">{props.data.mangaName}</span>
                        <span className="chapter">
                            <span className="text">
                                {window.app.replaceExtension(props.data.chapterName).split("$")[0]}
                            </span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                {window.app.isSupportedFormat(
                                    window.app.replaceExtension(props.data.chapterName)
                                ) && (
                                    <code className="nonFolder">
                                        {window.app.replaceExtension(props.data.chapterName).split("$")[1]}
                                    </code>
                                )}
                                {/* Page <span className="num">{(props.data.page || 1).toString()}</span> */}
                            </span>
                        </span>
                    </span>
                )}
            </a>
            {/* <div className="infoWrapper">
                <InfoOnHover />
            </div> */}
        </li>
    );
};

export default BookmarkHistoryListItem;
