import { useAppSelector } from "@store/hooks";
import { useState, useRef } from "react";
import BookmarkHistoryListItem from "./BookmarkHistoryListItem";

const HistoryTab = () => {
    const library = useAppSelector((store) => store.library.items);
    const appSettings = useAppSelector((store) => store.appSettings);
    const shortcuts = useAppSelector((store) => store.shortcuts);

    const [filter, setFilter] = useState<string>("");
    const [focused, setFocused] = useState(-1);
    const locationContRef = useRef<HTMLDivElement>(null);
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
                            if (['"', "`", "'"].includes(val[0])) {
                                filter = "^" + val.replaceAll(/('|"|`)/g, "");
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
                            //todo add proper stopPropagation to make sure globals dont stop working
                            e.stopPropagation();
                            if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                                e.preventDefault();
                            }
                            if (e.key === "Escape") {
                                e.currentTarget.blur();
                            }
                            //todo make it resuable
                            const keyStr = window.keyFormatter(e);
                            if (keyStr === "") return;
                            const shortcutsMapped = Object.fromEntries(
                                shortcuts.map((e) => [e.command, e.keys])
                            ) as Record<ShortcutCommands, string[]>;

                            // switch (true) {
                            //     case shortcutsMapped["contextMenu"].includes(keyStr): {
                            //         const elem = locationContRef.current?.querySelector(
                            //             '[data-focused="true"] a'
                            //         ) as HTMLLIElement | null;
                            //         if (elem) {
                            //             e.stopPropagation();
                            //             e.preventDefault();
                            //             e.currentTarget.blur();
                            //             elem.dispatchEvent(window.contextMenu.fakeEvent(elem, e.currentTarget));
                            //         }
                            //         break;
                            //     }
                            //     case shortcutsMapped["listDown"].includes(keyStr):
                            //         e.preventDefault();
                            //         setFocused((init) => {
                            //             if (init + 1 >= history.length) return 0;
                            //             return init + 1;
                            //         });
                            //         break;
                            //     case shortcutsMapped["listUp"].includes(keyStr):
                            //         e.preventDefault();
                            //         setFocused((init) => {
                            //             if (init - 1 < 0) return history.length - 1;
                            //             return init - 1;
                            //         });
                            //         break;
                            //     case shortcutsMapped["listSelect"].includes(keyStr): {
                            //         const elem = locationContRef.current?.querySelector(
                            //             '[data-focused="true"] a'
                            //         ) as HTMLLIElement | null;
                            //         if (elem) return elem.click();
                            //         const elems = locationContRef.current?.querySelectorAll("a");
                            //         if (elems?.length === 1) elems[0].click();
                            //         break;
                            //     }
                            //     default:
                            //         break;
                            // }
                        }}
                    />
                </div>
            )}
            <div className="location-cont" ref={locationContRef}>
                {Object.keys(library).length === 0 ? (
                    <p>Library Empty</p>
                ) : (
                    <ol>
                        {[...Object.values(library)]
                            .filter((e) =>
                                new RegExp(filter, "ig").test(
                                    e.type === "manga"
                                        ? e.title +
                                              (window.app.formats.files.test(e.progress.chapterName || "")
                                                  ? `${window.path.extname(e.progress.chapterName || "")}`
                                                  : "")
                                        : e.title + ".epub"
                                )
                            )
                            .map((e, i, arr) => (
                                <BookmarkHistoryListItem
                                    isBookmark={false}
                                    isHistory={true}
                                    focused={focused >= 0 && focused % arr.length === i}
                                    link={e.link}
                                    key={`${e.updatedAt}-${i}`}
                                />
                            ))}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default HistoryTab;
