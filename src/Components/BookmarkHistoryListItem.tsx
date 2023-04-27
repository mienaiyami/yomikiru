import { useContext } from "react";
import { AppContext } from "../App";
import { setContextMenu } from "../store/contextMenu";
import { useAppDispatch } from "../store/hooks";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader } = useContext(AppContext);
    const dispatch = useAppDispatch();
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
    return (
        <li
            title={
                `Manga   : ${props.mangaName}\n` +
                `Chapter : ${props.chapterName}\n` +
                `Pages    : ${props.pages}\n` +
                `Page      : ${props.page || 1}\n` +
                `Date      : ${props.date}`
            }
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
                onClick={() => openInReader(props.link, props.page)}
                onContextMenu={(e) => {
                    dispatch(
                        setContextMenu({
                            clickX: e.clientX,
                            clickY: e.clientY,
                            hasLink: {
                                link: props.link,
                                chapterItem: {
                                    item: props,
                                    isBookmark: props.isBookmark || false,
                                },
                            },
                        })
                    );
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
                <span className="double">
                    <span className="text">{props.mangaName}</span>
                    <span className="text chapter">
                        <span className="text">{props.chapterName}</span>
                        &nbsp;&nbsp;&nbsp;
                        <span className="page">
                            {" "}
                            Page <span className="num">{(props.page || 1).toString()}</span>
                        </span>
                    </span>
                </span>
            </a>
            {/* <div className="infoWrapper">
                <InfoOnHover />
            </div> */}
        </li>
    );
};

export default BookmarkHistoryListItem;
