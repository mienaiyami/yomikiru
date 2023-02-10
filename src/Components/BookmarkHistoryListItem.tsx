import { useContext } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
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
                className="a-context"
                onClick={() => openInReader(props.link, props.page)}
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
            {/* <div className="infoWrapper">
                <InfoOnHover />
            </div> */}
        </li>
    );
};

export default BookmarkHistoryListItem;
