import { faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useState } from "react";
import { AppContext } from "../App";
import { MainContext } from "./Main";

const LocationListItem = ({
    name,
    link,
    inHistory,
    setCurrentLink,
}: {
    name: string;
    link: string;
    setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
    inHistory?: boolean;
}): ReactElement => {
    const { openInReader } = useContext(AppContext);
    const { showContextMenu } = useContext(MainContext);
    return (
        <li className={inHistory ? "already-read" : ""}>
            <a
                className="a-context"
                title={name}
                onClick={() => {
                    if (window.fs.existsSync(link) && window.fs.lstatSync(link).isDirectory())
                        setCurrentLink(link);
                }}
                onContextMenu={(e) => {
                    showContextMenu({
                        e: e.nativeEvent,
                        isFile: true,
                        link: link,
                    });
                }}
                tabIndex={-1}
            >
                <span className="text">{name}</span>
            </a>
            <button
                title="Open In Reader"
                className="open-in-reader-btn"
                // onFocus={(e) => e.currentTarget.blur()}
                onClick={() => openInReader(link)}
                // onclick="makeImg($(this).siblings('a').attr('data-link'))"
            >
                <FontAwesomeIcon icon={faAngleRight} />
            </button>
        </li>
    );
};

export default LocationListItem;
