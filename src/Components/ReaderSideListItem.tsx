import { forwardRef, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";

const ReaderSideListItem = forwardRef(
    (
        {
            name,
            pages,
            parentLink,
            alreadyRead,
            current,
            realRef,
        }: {
            name: string;
            pages: number;
            parentLink: string;
            alreadyRead: boolean;
            current: boolean;
            realRef?: React.RefObject<HTMLAnchorElement>;
        },
        ref: React.ForwardedRef<HTMLAnchorElement>
    ) => {
        const { openInReader } = useContext(AppContext);
        const { showContextMenu } = useContext(MainContext);
        useEffect(() => {
            if (current) {
                realRef?.current?.scrollIntoView();
            }
        }, [realRef]);
        return (
            <li className={(alreadyRead ? "alreadyRead" : "") + " " + (current ? "current" : "")}>
                <a
                    className="a-context"
                    onClick={() => openInReader(window.path.join(parentLink, name))}
                    title={name}
                    ref={ref}
                    onContextMenu={(e) => {
                        showContextMenu({
                            e: e.nativeEvent,
                            isFile: true,
                            link: window.path.join(parentLink, name),
                        });
                    }}
                >
                    <span className="text">{name}</span>
                    <span className="pageNum" title="Total Pages">
                        {pages}
                    </span>
                </a>
            </li>
        );
    }
);

export default ReaderSideListItem;
