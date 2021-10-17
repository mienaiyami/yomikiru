import {
    faArrowLeft,
    faArrowRight,
    faBookmark,
    faFile,
    faMinus,
    faPlus,
    faSort,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const Reader = ({
    pageNumberInputRef,
}: {
    pageNumberInputRef: React.RefObject<HTMLInputElement>;
}) => {
    return (
        <div id="reader">
            <div className="ctrl-bar">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    // style="display: none"
                >
                    <defs>
                        <filter id="goo">
                            <feGaussianBlur
                                in="SourceGraphic"
                                stdDeviation="10"
                                result="blur"
                            />
                            <feColorMatrix
                                in="blur"
                                type="matrix"
                                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                                result="goo"
                            />
                            <feBlend in="SourceGraphic" in2="goo" />
                        </filter>
                    </defs>
                </svg>
                <button
                    className="ctrl-menu-item ctrl-menu-extender nonFocusable"
                    tabIndex={-1}
                    id="ctrl-menu-extender"
                    data-tooltip="Tools"
                >
                    <div className="cont">
                        <div className="bar"></div>
                        <div className="bar"></div>
                        <div className="bar"></div>
                    </div>
                </button>
                <div className="ctrl-menu">
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-plus"
                        data-tooltip="Size +"
                    >
                        <FontAwesomeIcon icon={faPlus} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-minus"
                        data-tooltip="Size -"
                    >
                        <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-prev"
                        data-tooltip="Open Previous"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-next"
                        data-tooltip="Open Next"
                    >
                        <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-bookmark"
                        data-tooltip="Bookmark"
                    >
                        <FontAwesomeIcon icon={faBookmark} />
                    </button>
                    <button
                        className="ctrl-menu-item nonFocusable"
                        tabIndex={-1}
                        id="ctrl-menu-page"
                        data-tooltip="Navigate To Page"
                        onClick={() => pageNumberInputRef.current?.focus()}
                    >
                        <FontAwesomeIcon icon={faFile} />
                    </button>
                </div>
            </div>
            <div className="currentMangaList">
                <div className="tool">
                    <input
                        type="text"
                        name=""
                        id="locationInput2"
                        spellCheck={false}
                        placeholder="Type to Search"
                        tabIndex={-1}
                        data-tooltip="Navigate To Page"
                    />

                    <button
                        id="inverseSort2"
                        tabIndex={-1}
                        data-value="normal"
                        data-tooltip="Sort"
                    >
                        <FontAwesomeIcon icon={faSort} />
                    </button>
                </div>
                <h1>
                    Manga: <span className="mangaName"></span>
                    <br />
                    Chapter: <span className="chapterName"></span>
                </h1>
                <div className="location-cont">
                    <ol></ol>
                </div>
            </div>
            <section className="imgCont"></section>
        </div>
    );
};

export default Reader;
