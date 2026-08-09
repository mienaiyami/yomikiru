import { faClose } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { removeShortcuts, setShortcuts } from "@store/shortcuts";
import { dialogUtils } from "@utils/dialog";
import { keyFormatter, mouseEventFormatter, SHORTCUT_COMMAND_MAP } from "@utils/keybindings";
import { createRendererLogger } from "@utils/logger";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsContext } from "../Settings";
import { reservedKeys, SHORTCUT_LIMIT } from "../utils/constants";

const log = createRendererLogger("settings/Shortcuts");

const ShortcutInput = ({ command }: { command: ShortcutCommands }) => {
    const { t } = useTranslation("settings");
    const { t: tReader } = useTranslation("reader");
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const dispatch = useAppDispatch();
    const shortcut = shortcuts.find((e) => e.command === command);
    if (!shortcut) return <p>{t("shortcuts.commandNotFound", { command })}</p>;

    const tryAddShortcut = (newKey: string, inputRef?: HTMLInputElement) => {
        const dupIndex = shortcuts.findIndex((s) => s.keys.includes(newKey));
        if (dupIndex >= 0) {
            const nameKey =
                SHORTCUT_COMMAND_MAP.find((s) => s.command === shortcuts[dupIndex].command)?.name || command;
            const name = nameKey.startsWith("shortcutNames.") ? tReader(nameKey) : nameKey;
            log.warn(`"${newKey}" already bound to "${shortcuts[dupIndex].command}"`);
            dialogUtils.warn({ message: t("shortcuts.alreadyBound", { key: newKey, name }) });
            return;
        }
        if (reservedKeys.includes(newKey)) {
            dialogUtils.warn({ message: t("shortcuts.reservedCombo") });
            log.warn(`"${newKey}" is reserved key combination.`);
            inputRef?.focus();
            return;
        }
        dispatch(setShortcuts({ command, key: newKey }));
    };

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
                        const newKey = keyFormatter(e.nativeEvent);
                        if (newKey === "") return;
                        tryAddShortcut(newKey, e.currentTarget);
                    }}
                    onMouseDown={(e) => {
                        const newKey = mouseEventFormatter(e.nativeEvent);
                        if (newKey === "") return;
                        e.preventDefault();
                        e.stopPropagation();
                        tryAddShortcut(newKey);
                    }}
                    placeholder={t("shortcuts.addNew")}
                    readOnly
                    spellCheck={false}
                />
            )}
        </>
    );
};

const Shortcuts = (): ReactElement => {
    const { t } = useTranslation("settings");
    const { t: tReader } = useTranslation("reader");
    const { scrollIntoView } = useSettingsContext();
    return (
        <div className="shortcutKey">
            <ul>
                <li>{t("shortcuts.hintRestart")}</li>
                <li>{t("shortcuts.hintMiddleMouse")}</li>
                <li>{t("shortcuts.hintMouse45")}</li>
                <li>
                    {t("shortcuts.hintBackspaceBefore")}
                    <code>{t("shortcuts.backspace")}</code>
                    {t("shortcuts.hintBackspaceAfter")}
                </li>
                <li>
                    {t("shortcuts.reservedKeys")}
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
                        <th>{t("shortcuts.function")}</th>
                        <th>{t("shortcuts.key")}</th>
                    </tr>
                    {SHORTCUT_COMMAND_MAP.map((e) => (
                        <tr key={e.command}>
                            <td>
                                {tReader(e.name)}
                                {(["dirUp", "contextMenu"] as ShortcutCommands[]).includes(e.command) && (
                                    <a
                                        onClick={() => {
                                            scrollIntoView("#settings-usage-searchShortcutKeys", "extras");
                                        }}
                                    >
                                        {t("shared.moreInfoDot")}
                                    </a>
                                )}
                            </td>
                            <td>
                                <ShortcutInput command={e.command} />
                            </td>
                        </tr>
                    ))}
                    <tr>
                        <td>{t("shortcuts.newWindow")}</td>
                        <td>
                            <code>ctrl+n</code>
                        </td>
                    </tr>
                    <tr>
                        <td>{t("shortcuts.closeWindow")}</td>
                        <td>
                            <code>ctrl+w</code>
                        </td>
                    </tr>
                    <tr>
                        <td>{t("shortcuts.readerWidth")}</td>
                        <td>
                            <code>ctrl+scroll</code>
                        </td>
                    </tr>
                    <tr>
                        <td>{t("shortcuts.reloadUi")}</td>
                        <td>
                            <code>ctrl+r</code>
                        </td>
                    </tr>
                    <tr>
                        <td>{t("shortcuts.reloadUiClearCache")}</td>
                        <td>
                            <code>ctrl+shift+r</code>
                        </td>
                    </tr>
                    <tr>
                        <td>{t("shortcuts.devTool")}</td>
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
