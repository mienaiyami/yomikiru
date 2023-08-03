import { useAppDispatch, useAppSelector } from "../store/hooks";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";
import { useState, useRef } from "react";

const HistoryTab = () => {
    const history = useAppSelector((store) => store.history);
    const appSettings = useAppSelector((store) => store.appSettings);

    const [filter, setFilter] = useState<string>("");
    const [focused, setFocused] = useState(-1);
    const locationContRef = useRef<HTMLDivElement>(null);
    const realList = (historyData: HistoryItem[], filter: string) => {
        return historyData.filter((e) => {
            if (
                new RegExp(filter, "ig").test(
                    e.type === "image"
                        ? e.data.mangaName +
                              (window.app.isSupportedFormat(e.data.chapterName)
                                  ? `.${window.path.extname(e.data.chapterName)}`
                                  : "")
                        : e.data.title + ".epub"
                )
            ) {
                return true;
            }
        });
    };
    return (
        <div className={"contTab listCont " + (!appSettings.showTabs.history ? "collapsed " : "")} id="historyTab">
            <h2>Continue Reading</h2>

            {appSettings.showSearch && (
                <div className="tools">
                    <input
                        type="text"
                        name=""
                        spellCheck={false}
                        placeholder="Type to Search"
                        // tabIndex={-1}
                        onChange={(e) => {
                            const val = e.target.value;
                            let filter = "";
                            if (val[0] === '"') {
                                filter = "^" + val.replaceAll('"', "");
                            } else
                                for (let i = 0; i < val.length; i++) {
                                    filter += val[i] + ".*";
                                }
                            setFocused(-1);
                            setFilter(filter);
                        }}
                        onBlur={() => {
                            setFocused(-1);
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }
                            if (e.key === "Escape") {
                                e.currentTarget.blur();
                            }
                            if ((e.ctrlKey && e.key === "/") || (e.shiftKey && e.key === "F10"))
                                e.key = "ContextMenu";

                            switch (e.key) {
                                case "ContextMenu": {
                                    const elem = locationContRef.current?.querySelector(
                                        '[data-focused="true"] a'
                                    ) as HTMLLIElement | null;
                                    if (elem) {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        e.currentTarget.blur();
                                        elem.dispatchEvent(window.contextMenu.fakeEvent(elem, e.currentTarget));
                                    }
                                    break;
                                }
                                case "ArrowDown":
                                    setFocused((init) => {
                                        if (init + 1 >= history.length) return 0;
                                        return init + 1;
                                    });
                                    break;
                                case "ArrowUp":
                                    setFocused((init) => {
                                        if (init - 1 < 0) return history.length - 1;
                                        return init - 1;
                                    });
                                    break;
                                case "Enter": {
                                    const elem = locationContRef.current?.querySelector(
                                        '[data-focused="true"] a'
                                    ) as HTMLLIElement | null;
                                    if (elem) elem.click();
                                    break;
                                }
                                default:
                                    break;
                            }
                        }}
                    />
                </div>
            )}
            <div className="location-cont" ref={locationContRef}>
                {history.length === 0 ? (
                    <p>No History...</p>
                ) : (
                    <ol>
                        {realList(history, filter).map((e, i, arr) => (
                            <BookmarkHistoryListItem
                                isBookmark={false}
                                isHistory={true}
                                index={i}
                                focused={focused % arr.length === i}
                                {...e}
                                key={e.data.date}
                            />
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default HistoryTab;
