import { useLayoutEffect, useRef, useState } from "react";

const InfoOnHover = (props: IhoverInfo) => {
    const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: props.y });
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (ref.current) {
            let x = 0;
            if (props.column === 2) {
                x =
                    (document
                        .querySelector<HTMLDivElement>("#bookmarksTab .location-cont")
                        ?.getBoundingClientRect().right || 0) - 10;
                if (x + ref.current.offsetWidth > window.innerWidth) {
                    x =
                        (document
                            .querySelector<HTMLDivElement>("#bookmarksTab .location-cont")
                            ?.getBoundingClientRect().left || 0) - ref.current.offsetWidth;
                }
            }
            if (props.column === 3) {
                x =
                    (document.querySelector<HTMLDivElement>("#historyTab .location-cont")?.getBoundingClientRect()
                        .x || 0) - ref.current.offsetWidth;
            }
            let y = props.y;
            if (y > window.innerHeight - ref.current.offsetHeight - 20) {
                y = window.innerHeight - ref.current.offsetHeight - 20;
            }
            setPos({ x, y });
        }
    }, [props]);
    return (
        <div className="infoOnHover" ref={ref} style={{ left: pos.x + "px", top: pos.y + "px" }}>
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
