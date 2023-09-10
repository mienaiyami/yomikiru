import React from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setShortcuts } from "../../store/shortcuts";

const Shortcuts = ({
    settingContRef,
    scrollIntoView,
}: {
    settingContRef: React.RefObject<HTMLDivElement>;
    scrollIntoView: (
        elementQuery: string,
        tab: "settings" | "shortcutKeys" | "makeTheme" | "about" | "extras"
    ) => void;
}) => {
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const dispatch = useAppDispatch();

    const reservedKeys = ["h", "Control", "Tab", "Shift", "Alt", "Escape"];

    const ShortcutInput = ({ which, i }: { which: "key1" | "key2"; i: number }) => (
        <input
            type="text"
            value={shortcuts[i][which] === " " ? "Space" : shortcuts[i][which]}
            onKeyDown={(e) => {
                e.stopPropagation();
            }}
            onKeyUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (reservedKeys.includes(e.key)) {
                    window.logger.warn(`"${e.key}"` + " is reserved key.");
                    e.currentTarget.focus();
                    return;
                }
                settingContRef.current?.focus();
                if (e.key === "Backspace") {
                    window.logger.log(`Deleting shortcut ${shortcuts[i].command}.${which}`);
                    dispatch(setShortcuts({ index: i, key: "", which }));
                    return;
                }
                const dupIndex = shortcuts.findIndex((elem) => elem.key1 === e.key || elem.key2 === e.key);
                if (dupIndex >= 0) {
                    window.logger.warn(`"${e.key}" key already bind to "${shortcuts[dupIndex].name}"`);
                    window.dialog.warn({
                        message: `"${e.key}" key already bind to "${shortcuts[dupIndex].name}".`,
                    });
                    return;
                }
                window.logger.log(`Setting shortcut ${shortcuts[i].command}.${which} to "${e.key}"`);
                dispatch(setShortcuts({ index: i, key: e.key, which }));
            }}
            readOnly
            spellCheck={false}
        />
    );

    return (
        <div className="shortcutKey">
            <ul>
                <li>
                    <code>Backspace</code> to delete Key.
                </li>
                <li>You can use middle mouse button or grab to scroll reader.</li>
                <li>
                    You can set <code>shift</code>+<code>key</code>, shortcut will appear as capital or symbol.
                </li>
                <li>
                    Reserved Keys :{" "}
                    {reservedKeys.map((e) => (
                        <span key={e}>
                            <code>{e}</code>{" "}
                        </span>
                    ))}
                    .
                </li>
            </ul>
            <table>
                <tbody>
                    <tr>
                        <th>Function</th>
                        <th>Key</th>
                    </tr>
                    {shortcuts.map((e, i) => (
                        <tr key={e.command}>
                            <td>{e.name}</td>
                            <td>
                                <ShortcutInput which="key1" i={i} />
                                <ShortcutInput which="key2" i={i} />
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td>Home</td>
                        <td>
                            <code>h</code>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Directory Up
                            <a
                                onClick={() => {
                                    scrollIntoView("#settings-usage-searchShortcutKeys", "extras");
                                }}
                            >
                                More Info.
                            </a>
                        </td>
                        <td>
                            <code>alt</code>+<code>ArrowUp</code>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Context Menu
                            <a
                                onClick={() => {
                                    scrollIntoView("#settings-usage-searchShortcutKeys", "extras");
                                }}
                            >
                                More Info.
                            </a>
                        </td>
                        <td>
                            (<code>ctrl</code>+<code>/</code>) or (<code>shift</code>+<code>F10</code>) or{" "}
                            <code>ContextMenu/Menu</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reader Size : 50%</td>
                        <td>
                            <code>ctrl</code>+<code>1</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reader Size : 100%</td>
                        <td>
                            <code>ctrl</code>+<code>2</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reader Size : 150%</td>
                        <td>
                            <code>ctrl</code>+<code>3</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reader Size : 200%</td>
                        <td>
                            <code>ctrl</code>+<code>4</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reader Size : 250%</td>
                        <td>
                            <code>ctrl</code>+<code>5</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Settings</td>
                        <td>
                            <code>ctrl</code>+<code>i</code>
                        </td>
                    </tr>
                    <tr>
                        <td>New Window</td>
                        <td>
                            <code>ctrl</code>+<code>n</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Close Window</td>
                        <td>
                            <code>ctrl</code>+<code>w</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reader width</td>
                        <td>
                            <code>ctrl</code>+<code>scroll</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reload UI</td>
                        <td>
                            <code>ctrl</code>+<code>r</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reload UI and try to clear cache</td>
                        <td>
                            <code>ctrl</code>+<code>shift</code>+<code>r</code>
                        </td>
                    </tr>
                    <tr>
                        <td>UI Scale Up</td>
                        <td>
                            <code>ctrl</code> + <code>=</code>
                        </td>
                    </tr>
                    <tr>
                        <td>UI Scale Down</td>
                        <td>
                            <code>ctrl</code> + <code>-</code>
                        </td>
                    </tr>
                    <tr>
                        <td>UI Scale Reset</td>
                        <td>
                            <code>ctrl</code> + <code>0</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Dev Tool</td>
                        <td>
                            <code>ctrl</code>+<code>shift</code>+<code>i</code>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default Shortcuts;
