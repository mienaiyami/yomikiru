import { useEffect, useLayoutEffect, useRef, useState } from "react";

const InfoOnHover = (props: IhoverInfo) => {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: props.y });
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (ref.current) {
            // if (document.querySelector(props.parent)) {
            //     let x = 0;
            //     if (props.parent === "#bookmarksTab .location-cont") {
            //         x = document.querySelector<HTMLDivElement>(props.parent)!.getBoundingClientRect().right;
            //         if (x + ref.current.offsetWidth > window.innerWidth) {
            //             x =
            //                 document.querySelector<HTMLDivElement>(props.parent)!.getBoundingClientRect().left -
            //                 ref.current.offsetWidth;
            //         }
            //     }
            //     if (props.parent === "#historyTab .location-cont") {
            //         x =
            //             // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            //             document.querySelector<HTMLDivElement>(props.parent)!.getBoundingClientRect().x -
            //             ref.current.offsetWidth;
            //     }
            //     let y = props.y - window.app.titleBarHeight;
            //     if (y > window.innerHeight - ref.current.offsetHeight - window.app.titleBarHeight - 5) {
            //         y = window.innerHeight - ref.current.offsetHeight - window.app.titleBarHeight - 5;
            //     }
            //     setPos({ x, y });
            // }
            let x = 0;
            if (props.column === 2) {
                x = document
                    .querySelector<HTMLDivElement>("#bookmarksTab .location-cont")!
                    .getBoundingClientRect().right;
                if (x + ref.current.offsetWidth > window.innerWidth) {
                    x =
                        document
                            .querySelector<HTMLDivElement>("#bookmarksTab .location-cont")!
                            .getBoundingClientRect().left - ref.current.offsetWidth;
                }
            }
            if (props.column === 3) {
                x =
                    document.querySelector<HTMLDivElement>("#historyTab .location-cont")!.getBoundingClientRect()
                        .x - ref.current.offsetWidth;
            }
            let y = props.y - window.app.titleBarHeight;
            if (y > window.innerHeight - ref.current.offsetHeight - window.app.titleBarHeight - 5) {
                y = window.innerHeight - ref.current.offsetHeight - window.app.titleBarHeight - 5;
            }
            setPos({ x, y });
        }
    }, [props]);
    useEffect(() => {
        const setVib = setTimeout(() => setVisible(true), 500);
        return () => clearTimeout(setVib);
    }, [props]);
    return (
        <div
            className="infoOnHover"
            ref={ref}
            style={{ left: pos.x + "px", top: pos.y + "px", visibility: visible ? "visible" : "hidden" }}
        >
            <div className="info-cont">
                <div className="title">Manga</div>
                <div className="info">{props.item.mangaName}</div>
            </div>
            <div className="info-cont">
                <div className="title">Chapter</div>
                <div className="info">{props.item.chapterName}</div>
            </div>
            <div className="info-cont">
                <div className="title">Pages</div>
                <div className="info">{props.item.pages}</div>
            </div>
            <div className="info-cont">
                <div className="title">Date</div>
                <div className="info">{props.item.date}</div>
            </div>
        </div>
    );
};

export default InfoOnHover;
