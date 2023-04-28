import { useContext, memo } from "react";
import { AppContext } from "../App";
import { setContextMenu } from "../store/contextMenu";
import { useAppDispatch } from "../store/hooks";

const ReaderSideListItem = memo(
    ({
        name,
        pages,
        link,
        alreadyRead,
        current,
    }: {
        name: string;
        pages: number;
        link: string;
        alreadyRead: boolean;
        current: boolean;
    }) => {
        const { openInReader } = useContext(AppContext);

        const dispatch = useAppDispatch();

        return (
            <li className={(alreadyRead ? "alreadyRead" : "") + " " + (current ? "current" : "")}>
                <a
                    onClick={() => openInReader(link)}
                    title={name}
                    ref={(node) => {
                        if (current && node !== null) node.scrollIntoView();
                    }}
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
                    <span className="text">{name.split(" $")[0]}</span>
                    {window.app.isSupportedFormat(name) ? (
                        <code className="nonFolder">{name.split(" $")[1]}</code>
                    ) : (
                        <span className="pageNum" title="Total Pages">
                            {pages}
                        </span>
                    )}
                </a>
            </li>
        );
    }
);

export default ReaderSideListItem;
