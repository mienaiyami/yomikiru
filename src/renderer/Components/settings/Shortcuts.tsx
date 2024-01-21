import React from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { removeShortcuts, setShortcuts } from "../../store/shortcuts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClose } from "@fortawesome/free-solid-svg-icons";

const reservedKeys = ["ctrl+shift+i", "escape", "tab", "ctrl+n", "ctrl+w", "ctrl+r", "ctrl+shift+r"];
const SHORTCUT_LIMIT = 4;

const ShortcutInput = ({ command }: { command: ShortcutCommands }) => {
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const dispatch = useAppDispatch();
    const shortcut = shortcuts.find((e) => e.command === command);
    if (!shortcut) return <p>Command "{command}" not found.</p>;
    return (
        <>
            {shortcut.keys.map((key, i) => (
                <div className="keyDisplay" key={i} title={key}>
                    <input
                        type="text"
                        value={key}
                        readOnly
                        spellCheck={false}
                        onKeyDown={(e) => {
                            if (e.key === "Backspace") {
                                e.preventDefault();
                                e.stopPropagation();
                                dispatch(removeShortcuts({ command, key }));
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            dispatch(removeShortcuts({ command, key }));
                        }}
                    >
                        <FontAwesomeIcon icon={faClose} />
                    </button>
                </div>
            ))}
            {shortcut.keys.length < SHORTCUT_LIMIT && (
                <input
                    className="addNewKey"
                    type="text"
                    value={""}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        if (!["Tab", "Escape"].includes(e.key)) e.preventDefault();
                    }}
                    onKeyUp={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const newKey = window.keyFormatter(e.nativeEvent);
                        if (newKey === "") return;
                        const dupIndex = shortcuts.findIndex((e) => e.keys.includes(newKey));
                        if (dupIndex >= 0) {
                            const name =
                                window.SHORTCUT_COMMANDS.find((e) => e.command === shortcuts[dupIndex].command)
                                    ?.name || command;
                            window.logger.warn(`"${newKey}" already bound to "${shortcuts[dupIndex].command}"`);
                            window.dialog.warn({
                                message: `"${newKey}" already bound to "${name}".`,
                            });
                            return;
                        }

                        if (reservedKeys.includes(newKey)) {
                            //todo make a simple alert
                            window.dialog.warn({
                                message: "Can't use reserved key combination.",
                            });
                            window.logger.warn(`"${newKey}"` + " is reserved key combination.");

                            e.currentTarget.focus();
                            return;
                        }

                        dispatch(setShortcuts({ command, key: newKey }));
                    }}
                    placeholder="Add New"
                    readOnly
                    spellCheck={false}
                />
            )}
        </>
    );
};

const Shortcuts = ({
    // settingContRef,
    scrollIntoView,
}: {
    // settingContRef: React.RefObject<HTMLDivElement>;
    scrollIntoView: (
        elementQuery: string,
        tab: "settings" | "shortcutKeys" | "makeTheme" | "about" | "extras"
    ) => void;
}) => {
    return (
        <div className="shortcutKey">
            <ul>
                <li>Some changes may require app to restart.</li>
                <li>You can use middle mouse button or grab to scroll reader.</li>
                <li>
                    Use <code>Backspace</code> to clear key binding.
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
                    {window.SHORTCUT_COMMANDS.map((e, i) => (
                        <tr key={e.command}>
                            <td>
                                {e.name}
                                {(["dirUp", "contextMenu"] as ShortcutCommands[]).includes(e.command) && (
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-usage-searchShortcutKeys", "extras");
                                        }}
                                    >
                                        More Info.
                                    </a>
                                )}
                            </td>
                            <td>
                                <ShortcutInput command={e.command} />
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td>New Window</td>
                        <td>
                            <code>ctrl+n</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Close Window</td>
                        <td>
                            <code>ctrl+w</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reader width</td>
                        <td>
                            <code>ctrl+scroll</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reload UI</td>
                        <td>
                            <code>ctrl+r</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Reload UI and try to clear cache</td>
                        <td>
                            <code>ctrl+shift+r</code>
                        </td>
                    </tr>
                    <tr>
                        <td>Dev Tool</td>
                        <td>
                            <code>ctrl+shift+i</code>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default Shortcuts;
