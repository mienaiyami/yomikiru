import {
    type BindingDiagnostic,
    type BindingTrigger,
    COMMAND_CATALOG,
    COMMAND_GROUPS,
    type CommandGroup,
    type CommandId,
    compileKeymap,
    effectiveBindingsFor,
    formatTriggerForDisplay,
    projectBindingDiagnostics,
    serializeTrigger,
    triggerFromLive,
} from "@common/keybindings";
import { useKeybindingRuntime } from "@features/keybindings";
import { faClose, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { addKeymapBinding, removeKeymapBinding, resetKeymapCommand } from "@store/shortcuts";
import { createRendererLogger } from "@utils/logger";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { navigateToSetting } from "../utils/navigateToSetting";

const log = createRendererLogger("settings/Shortcuts");

const CATALOG_SECTIONS = COMMAND_GROUPS.map((group) => ({
    group,
    entries: COMMAND_CATALOG.filter((entry) => entry.group === group),
}));

/** i18n key for a Shortcuts group heading. */
const SHORTCUT_GROUP_LABEL_KEY = {
    readerNavigation: "shortcuts.groups.readerNavigation",
    readerView: "shortcuts.groups.readerView",
    readerPresets: "shortcuts.groups.readerPresets",
    home: "shortcuts.groups.home",
    lists: "shortcuts.groups.lists",
    window: "shortcuts.groups.window",
    settings: "shortcuts.groups.settings",
} as const satisfies Record<CommandGroup, `shortcuts.groups.${CommandGroup}`>;

/**
 * String leaves of a nested `t(..., { returnObjects: true })` bag.
 */
const hintLinesFromCopy = (value: unknown): [string, string][] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
};

/** Usage targets for commands whose Settings row has a More Info link. */
const MORE_INFO_TARGET: Partial<Record<CommandId, string>> = {
    dirUp: "usage:search-shortcut-keys",
    contextMenu: "usage:search-shortcut-keys",
    deleteSelected: "usage:multi-select",
};

type ShortcutAddControlProps = {
    isRecording: boolean;
    onStartRecording: () => void;
    onStopRecording: () => void;
};

/**
 * Idle Add button, or a same-size capture field while recording. The field is
 * a text input so Space chords are not treated as native button activation.
 */
const ShortcutAddControl = ({
    isRecording,
    onStartRecording,
    onStopRecording,
}: ShortcutAddControlProps): ReactElement => {
    const { t } = useTranslation("settings");
    const fieldRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isRecording) fieldRef.current?.focus();
    }, [isRecording]);

    if (isRecording) {
        return (
            <input
                ref={fieldRef}
                className="addNewKey recording"
                type="text"
                value=""
                readOnly
                spellCheck={false}
                placeholder={t("shortcuts.recording")}
                aria-label={t("shortcuts.recording")}
                onBlur={onStopRecording}
            />
        );
    }

    return (
        <button type="button" className="addNewKey" onClick={onStartRecording}>
            <FontAwesomeIcon icon={faPlus} />
            {t("shortcuts.addNew")}
        </button>
    );
};

type ShortcutCommandRowProps = {
    commandId: CommandId;
    label: string;
    moreInfoTarget?: string;
    bindings: readonly BindingTrigger[];
    diagnostics: readonly BindingDiagnostic[];
    isRecording: boolean;
    onStartRecording: () => void;
    onStopRecording: () => void;
};

/**
 * One catalog command: label, key chips, add/reset, and overlap notes.
 * Deep-link id is `#settings-shortcut-<commandId>`.
 */
const ShortcutCommandRow = ({
    commandId,
    label,
    moreInfoTarget,
    bindings,
    diagnostics,
    isRecording,
    onStartRecording,
    onStopRecording,
}: ShortcutCommandRowProps): ReactElement => {
    const { t } = useTranslation("settings");
    const { t: tReader } = useTranslation("reader");
    const dispatch = useAppDispatch();

    return (
        <div className="shortcutCommand" id={`settings-shortcut-${commandId}`}>
            <div className="shortcutCommandMain">
                <div className="shortcutCommandName">
                    <span>{label}</span>
                    {moreInfoTarget && (
                        <a
                            onClick={() => {
                                navigateToSetting(moreInfoTarget, dispatch);
                            }}
                        >
                            {t("shared.moreInfoDot")}
                        </a>
                    )}
                </div>
                <div className="shortcutCommandBindings">
                    {bindings.map((trigger) => {
                        const triggerId = serializeTrigger(trigger);
                        return (
                            <div className="shortcutChip" key={triggerId} title={triggerId}>
                                <span className="shortcutChord">{formatTriggerForDisplay(trigger)}</span>
                                <button
                                    type="button"
                                    className="shortcutChipRemove"
                                    aria-label={t("shortcuts.removeBinding")}
                                    onClick={() => {
                                        void dispatch(removeKeymapBinding({ commandId, trigger }));
                                    }}
                                >
                                    <FontAwesomeIcon icon={faClose} />
                                </button>
                            </div>
                        );
                    })}
                    <ShortcutAddControl
                        isRecording={isRecording}
                        onStartRecording={onStartRecording}
                        onStopRecording={onStopRecording}
                    />
                    <button
                        type="button"
                        className="shortcutReset"
                        onClick={() => {
                            void dispatch(resetKeymapCommand(commandId));
                        }}
                    >
                        {t("shared.reset")}
                    </button>
                </div>
            </div>
            {diagnostics.length > 0 && (
                <div className="shortcutCommandAlerts">
                    {diagnostics.map((diagnostic) => {
                        const triggerId = serializeTrigger(diagnostic.trigger);
                        return (
                            <p
                                key={triggerId}
                                className={
                                    diagnostic.severity === "warning" ? "shortcut-conflict" : "shortcut-reuse"
                                }
                            >
                                <span className="shortcutDiagChord">
                                    {formatTriggerForDisplay(diagnostic.trigger)}
                                </span>
                                {diagnostic.competitors.map((competitor) => {
                                    const competitorName = tReader(`shortcutNames.${competitor.commandId}`);
                                    return (
                                        <span key={competitor.commandId}>
                                            <Trans
                                                ns="settings"
                                                i18nKey={
                                                    competitor.overlap === "conflict"
                                                        ? "shortcuts.conflictWith"
                                                        : "shortcuts.harmlessReuse"
                                                }
                                                components={{
                                                    command: (
                                                        <a
                                                            onClick={() => {
                                                                navigateToSetting(
                                                                    `shortcut:${competitor.commandId}`,
                                                                    dispatch,
                                                                );
                                                            }}
                                                        >
                                                            {competitorName}
                                                        </a>
                                                    ),
                                                }}
                                            />
                                        </span>
                                    );
                                })}
                            </p>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/**
 * Settings Shortcut Keys tab: grouped command rows with add / remove / reset,
 * capture-on-click recording, and live overlap notes.
 */
const Shortcuts = (): ReactElement => {
    const { t } = useTranslation("settings");
    const { t: tReader } = useTranslation("reader");
    const dispatch = useAppDispatch();
    const runtime = useKeybindingRuntime();
    const keymapDocument = useAppSelector((store) => store.shortcuts.document);
    const platform = useAppSelector((store) => store.shortcuts.platform);
    const saveState = useAppSelector((store) => store.shortcuts.saveState);
    const staleCommandId = useAppSelector((store) => store.shortcuts.staleCommandId);
    const [recordingCommandId, setRecordingCommandId] = useState<CommandId | null>(null);

    const compiled = compileKeymap(keymapDocument.overrides, platform);
    // index overlap notes by command so each row does not rescan the full list
    const diagnosticsByCommandId = new Map<CommandId, BindingDiagnostic[]>();
    for (const diagnostic of projectBindingDiagnostics(compiled)) {
        const rows = diagnosticsByCommandId.get(diagnostic.commandId);
        if (rows) rows.push(diagnostic);
        else diagnosticsByCommandId.set(diagnostic.commandId, [diagnostic]);
    }

    useEffect(() => {
        return () => {
            runtime.cancelRecording();
        };
    }, [runtime]);

    const startRecording = (commandId: CommandId) => {
        runtime.beginRecording(
            (live) => {
                void dispatch(addKeymapBinding({ commandId, trigger: triggerFromLive(live) }));
                runtime.cancelRecording();
            },
            () => {
                setRecordingCommandId(null);
            },
        );
        setRecordingCommandId(commandId);
        log.info("recording binding", { commandId });
    };

    return (
        <div className="content2 shortcutKey">
            <div className="settingItem2" id="settings-shortcuts-help">
                <h3>{t("shortcuts.helpTitle")}</h3>
                <div className="desc">
                    <ul className="shortcutHints">
                        {hintLinesFromCopy(t("shortcuts.hints", { returnObjects: true })).map(
                            ([hintKey, line]) => (
                                <li key={hintKey}>{line}</li>
                            ),
                        )}
                    </ul>
                    {saveState === "failed" && <p className="shortcut-save-status">{t("shortcuts.saveFailed")}</p>}
                    {saveState === "stale" && (
                        <p className="shortcut-save-status">
                            {staleCommandId
                                ? t("shortcuts.saveStaleCommand", {
                                      name: tReader(`shortcutNames.${staleCommandId}`),
                                  })
                                : t("shortcuts.saveStale")}
                        </p>
                    )}
                </div>
            </div>
            {CATALOG_SECTIONS.map(({ group, entries }) => (
                <div className="settingItem2" key={group}>
                    <h3>{t(SHORTCUT_GROUP_LABEL_KEY[group])}</h3>
                    {entries.map((entry) => {
                        const commandId = entry.id;
                        return (
                            <ShortcutCommandRow
                                key={commandId}
                                commandId={commandId}
                                label={tReader(entry.labelKey)}
                                moreInfoTarget={MORE_INFO_TARGET[commandId]}
                                bindings={effectiveBindingsFor(keymapDocument, commandId, platform)}
                                diagnostics={diagnosticsByCommandId.get(commandId) ?? []}
                                isRecording={recordingCommandId === commandId}
                                onStartRecording={() => startRecording(commandId)}
                                onStopRecording={() => runtime.cancelRecording()}
                            />
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default Shortcuts;
