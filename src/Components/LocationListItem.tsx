import { faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useState } from "react";

const LocationListItem = ({
    name,
    link,
    inHistory,
    displayList,
    setCurrentLink,
}: {
    name: string;
    link: string;
    displayList: (link: string) => void;
    setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
    inHistory?: boolean;
}): ReactElement => {
    const [alreadyRead, setAlreadyRead] = useState(inHistory || false);
    return (
        <li className={alreadyRead ? "already-read" : ""}>
            <a
                className="a-context"
                onClick={() => {
                    console.log("aaaaaa");
                    if (
                        window.fs.existsSync(link) &&
                        window.fs.lstatSync(link).isDirectory()
                    )
                        setCurrentLink(link);
                }}
                // data-name="${e}"
                // data-link="${link}"
            >
                {name}
            </a>
            <button
                title="Open In Reader"
                className="open-in-reader-btn"
                // onclick="makeImg($(this).siblings('a').attr('data-link'))"
            >
                <FontAwesomeIcon icon={faAngleRight} />
            </button>
        </li>
    );
};

export default LocationListItem;
