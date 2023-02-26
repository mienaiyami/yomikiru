//!! check if it really need forward ref
import { forwardRef, useContext, useEffect } from "react";
import { AppContext } from "../App";
import { setContextMenu } from "../store/contextMenu";
import { useAppDispatch } from "../store/hooks";

const ReaderSideListItem = forwardRef(
    (
        {
            name,
            pages,
            link,
            alreadyRead,
            current,
            realRef,
        }: {
            name: string;
            pages: number;
            link: string;
            alreadyRead: boolean;
            current: boolean;
            realRef?: React.RefObject<HTMLAnchorElement> | null;
        },
        ref: React.ForwardedRef<HTMLAnchorElement>
    ) => {
        const { openInReader } = useContext(AppContext);

        const dispatch = useAppDispatch();

        useEffect(() => {
            if (current) {
                realRef?.current?.scrollIntoView();
            }
        }, [realRef]);
        return (
            <li className={(alreadyRead ? "alreadyRead" : "") + " " + (current ? "current" : "")}>
                <a
                    className="a-context"
                    onClick={() => openInReader(link)}
                    title={name}
                    ref={ref}
                    onContextMenu={(e) => {
                        dispatch(
                            setContextMenu({
                                clickX: e.clientX,
                                clickY: e.clientY,
                                hasLink: {
                                    link,
                                    simple: {
                                        isImage: false,
                                    },
                                },
                            })
                        );
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
