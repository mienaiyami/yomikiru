import { useCommandOwner } from "@features/keybindings";
import { BookReaderPresetSection } from "@features/reader/components/ReaderPresetSection";
import { BookReaderSettingSection } from "@features/reader/components/ReaderSettingSection";
import { stepFontSize, stepReaderWidth } from "@features/reader/readerCommandOps";
import { navigateToSetting } from "@features/settings/utils/navigateToSetting";
import { faBars, faMinus, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    getReaderBook,
    selectLiveBookPresetId,
    selectLiveBookReaderSettings,
    selectReaderCommandsActive,
} from "@store/reader";
import { getActiveBookPresetName, patchLiveBookReaderSettings, updateBookPreset } from "@store/readerPresets";
import InputCheckbox from "@ui/InputCheckbox";
import InputCheckboxColor from "@ui/InputCheckboxColor";
import InputCheckboxNumber from "@ui/InputCheckboxNumber";
import InputNumber from "@ui/InputNumber";
import InputRange from "@ui/InputRange";
import InputSelect from "@ui/InputSelect";
import { colorUtils } from "@utils/color";
import { createRendererLogger } from "@utils/logger";
import { memo, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import BackgroundSettings from "./components/BackgroundSettings";
import ContentFrameSettings from "./components/ContentFrameSettings";
import {
    BOOK_READER_OWNER_ID,
    BOOK_READER_PANEL_OWNER_ID,
    BOOK_READER_SETTINGS_OWNER_ID,
} from "./useBookCommandOwner";

const log = createRendererLogger("epub/EPubReaderSettings");

const EPUBReaderSettings = memo(
    ({
        makeScrollPos,
        readerRef,
        readerSettingExtender,
        setShortcutText,
    }: {
        makeScrollPos: () => void;
        readerRef: React.RefObject<HTMLDivElement>;
        readerSettingExtender: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
    }) => {
        const { t } = useTranslation("reader");
        const { t: tSettings } = useTranslation("settings");
        const appSettings = useAppSelector((store) => store.appSettings);
        const epubReaderSettings = useAppSelector(selectLiveBookReaderSettings);
        const bookInReader = useAppSelector(getReaderBook);
        const bookPresetId = useAppSelector(selectLiveBookPresetId);
        const currentPresetName = useAppSelector(getActiveBookPresetName);
        const commandsActive = useAppSelector(selectReaderCommandsActive);
        const dispatch = useAppDispatch();

        const [isReaderSettingsOpen, setReaderSettingOpen] = useState(false);
        const [fontList, setFontList] = useState<string[]>([]);

        useLayoutEffect(() => {
            window
                .getFonts()
                .then((e) => {
                    setFontList(e);
                })
                .catch((e) => {
                    log.error("getFonts() failed (system font list unavailable)", e);
                });
        }, []);

        const maxWidth = 100;
        const applySize = (direction: 1 | -1, fromButton?: HTMLElement) => {
            makeScrollPos();
            const readerWidth = stepReaderWidth(epubReaderSettings.readerWidth, maxWidth, direction);
            if (!fromButton || document.activeElement !== fromButton) setShortcutText(`${readerWidth}%`);
            dispatch(patchLiveBookReaderSettings({ readerWidth }));
        };
        const applyFontSize = (delta: number, fromButton?: HTMLElement) => {
            makeScrollPos();
            const fontSize = stepFontSize(epubReaderSettings.fontSize, delta);
            if (!fromButton || document.activeElement !== fromButton) setShortcutText(`${fontSize}px`);
            dispatch(patchLiveBookReaderSettings({ fontSize }));
        };
        const savePreset = () => {
            const presetId = bookPresetId;
            if (!presetId) return;
            dispatch(updateBookPreset({ id: presetId, data: epubReaderSettings }));
            setShortcutText(t("hud.savedToPreset", { name: currentPresetName ?? t("hud.unknownPreset") }));
        };

        useCommandOwner({
            ownerId: BOOK_READER_SETTINGS_OWNER_ID,
            contextKinds: ["bookReader"],
            visible: commandsActive,
            parentOwnerId: BOOK_READER_OWNER_ID,
            handlers: {
                readerSettings: () => {
                    setReaderSettingOpen((open) => !open);
                    readerSettingExtender.current?.focus();
                },
                sizePlus: () => applySize(1),
                sizeMinus: () => applySize(-1),
                fontSizePlus: () => applyFontSize(1),
                fontSizeMinus: () => applyFontSize(-1),
                savePreset,
            },
        });

        useCommandOwner({
            ownerId: BOOK_READER_PANEL_OWNER_ID,
            contextKinds: ["readerPanel"],
            visible: isReaderSettingsOpen,
            parentOwnerId: BOOK_READER_OWNER_ID,
            onEscape: () => {
                setReaderSettingOpen(false);
                readerRef.current?.focus();
                return true;
            },
        });
        return (
            <div
                id="epubReaderSettings"
                className={
                    "readerSettings " +
                    (isReaderSettingsOpen ? "" : "closed ") +
                    (appSettings.checkboxReaderSetting ? "checkboxSetting " : "")
                }
            >
                <button
                    className="menuExtender"
                    ref={readerSettingExtender}
                    onClick={() => setReaderSettingOpen((init) => !init)}
                    {...(!isReaderSettingsOpen ? { "data-tooltip": t("settings.readerSettingsTooltip") } : {})}
                >
                    <FontAwesomeIcon icon={isReaderSettingsOpen ? faTimes : faBars} />
                </button>
                <div className="main">
                    <BookReaderPresetSection />
                    <BookReaderSettingSection
                        title={t("settings.continuousChapters")}
                        collapsedKey="continuousChapters"
                        optionsClassName="col"
                    >
                        <InputCheckbox
                            checked={epubReaderSettings.continuousChapters}
                            disabled={!bookInReader?.link}
                            onChange={(e) => {
                                if (!bookInReader?.link) return;
                                window.app.flushEpubScrollPos?.();
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        continuousChapters: e.currentTarget.checked,
                                    }),
                                );
                            }}
                            paraAfter={t("settings.continuousChaptersEnable")}
                        />
                        <p className="settingHint">
                            {t("settings.continuousChaptersDesc")}{" "}
                            <a
                                className="real-anchor"
                                onClick={() => {
                                    navigateToSetting("usage:epub-continuous-scroll", dispatch);
                                }}
                            >
                                {tSettings("shared.moreInfo")}
                            </a>
                        </p>
                    </BookReaderSettingSection>
                    <BookReaderSettingSection title={t("settings.size")} collapsedKey="size">
                        <InputNumber
                            value={epubReaderSettings.readerWidth}
                            min={1}
                            max={maxWidth}
                            onChange={() => {
                                makeScrollPos();
                            }}
                            timeout={[
                                1000,
                                (value) => dispatch(patchLiveBookReaderSettings({ readerWidth: value })),
                            ]}
                            labelAfter={t("settings.percentUnit")}
                        />
                        <button
                            onClick={(e) => {
                                applySize(-1, e.currentTarget);
                            }}
                        >
                            <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button
                            onClick={(e) => {
                                applySize(1, e.currentTarget);
                            }}
                        >
                            <FontAwesomeIcon icon={faPlus} />
                        </button>
                        <div className="col">
                            <InputCheckbox
                                checked={epubReaderSettings.limitImgHeight}
                                onChange={(e) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            limitImgHeight: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.limitImgHeight")}
                            />
                        </div>
                    </BookReaderSettingSection>
                    <BookReaderSettingSection title={t("settings.fontAndLayout")} collapsedKey="font">
                        <div className="row">
                            <InputNumber
                                value={epubReaderSettings.fontSize}
                                min={1}
                                max={100}
                                onChange={() => {
                                    makeScrollPos();
                                }}
                                timeout={[
                                    1000,
                                    (value) => dispatch(patchLiveBookReaderSettings({ fontSize: value })),
                                ]}
                                labelAfter={t("settings.pxUnit")}
                            />
                            <button
                                onClick={(e) => {
                                    applyFontSize(-1, e.currentTarget);
                                }}
                            >
                                <FontAwesomeIcon icon={faMinus} />
                            </button>
                            <button
                                onClick={(e) => {
                                    applyFontSize(1, e.currentTarget);
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                        </div>
                        <div className="col">
                            <InputCheckbox
                                checked={!epubReaderSettings.useDefault_fontFamily}
                                onChange={(e) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            useDefault_fontFamily: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                paraAfter={t("settings.customFontFamily")}
                            />
                            <InputSelect
                                disabled={epubReaderSettings.useDefault_fontFamily}
                                value={epubReaderSettings.fontFamily}
                                onChange={(value) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            fontFamily: value,
                                        }),
                                    );
                                }}
                                options={[
                                    ...epubReaderSettings.quickFontFamily.map(
                                        (e) =>
                                            ({
                                                label: `★ ${e.replaceAll('"', "")}`,
                                                value: e,
                                                style: { fontFamily: e, fontSize: "1.2em" },
                                            }) as Menu.OptSelectOption,
                                    ),
                                    ...fontList.map(
                                        (e) =>
                                            ({
                                                label: e.replaceAll('"', ""),
                                                value: e,
                                                style: { fontFamily: e, fontSize: "1.2em" },
                                            }) as Menu.OptSelectOption,
                                    ),
                                ]}
                            />
                            <button
                                disabled={epubReaderSettings.useDefault_fontFamily}
                                onClick={() => {
                                    if (
                                        epubReaderSettings.quickFontFamily.includes(epubReaderSettings.fontFamily)
                                    ) {
                                        dispatch(
                                            patchLiveBookReaderSettings({
                                                quickFontFamily: epubReaderSettings.quickFontFamily.filter(
                                                    (e) => e !== epubReaderSettings.fontFamily,
                                                ),
                                            }),
                                        );
                                    } else {
                                        dispatch(
                                            patchLiveBookReaderSettings({
                                                quickFontFamily: [
                                                    ...epubReaderSettings.quickFontFamily,
                                                    epubReaderSettings.fontFamily,
                                                ],
                                            }),
                                        );
                                    }
                                }}
                            >
                                {epubReaderSettings.quickFontFamily.includes(epubReaderSettings.fontFamily)
                                    ? t("settings.removeStar")
                                    : t("settings.starFontFamily")}
                            </button>
                            <InputCheckbox
                                checked={!epubReaderSettings.useDefault_fontWeight}
                                onChange={(e) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            useDefault_fontWeight: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                title={t("settings.fontWeightTitle")}
                                paraAfter={t("settings.fontWeight")}
                            />
                            <InputRange
                                value={epubReaderSettings.fontWeight}
                                disabled={epubReaderSettings.useDefault_fontWeight}
                                min={100}
                                max={900}
                                step={100}
                                labeled
                                labelText=""
                                timeout={[
                                    350,
                                    (value) => {
                                        makeScrollPos();
                                        dispatch(
                                            patchLiveBookReaderSettings({
                                                fontWeight: value,
                                            }),
                                        );
                                    },
                                ]}
                            />
                            <InputCheckboxNumber
                                checked={!epubReaderSettings.useDefault_lineSpacing}
                                onChangeCheck={(e) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            useDefault_lineSpacing: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                step={0.1}
                                min={0}
                                max={10}
                                value={epubReaderSettings.lineSpacing}
                                timeout={[
                                    1000,
                                    (value) => {
                                        makeScrollPos();
                                        dispatch(patchLiveBookReaderSettings({ lineSpacing: value }));
                                    },
                                ]}
                                paraBefore={t("settings.lineHeight")}
                                paraAfter={t("settings.emUnit")}
                            />
                            <InputCheckboxNumber
                                checked={!epubReaderSettings.useDefault_paragraphSpacing}
                                onChangeCheck={(e) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            useDefault_paragraphSpacing: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                step={0.1}
                                min={0}
                                max={10}
                                value={epubReaderSettings.paragraphSpacing}
                                timeout={[
                                    1000,
                                    (value) => {
                                        makeScrollPos();
                                        dispatch(patchLiveBookReaderSettings({ paragraphSpacing: value }));
                                    },
                                ]}
                                paraBefore={t("settings.paragraphSpacing")}
                                paraAfter={t("settings.emUnit")}
                            />
                            <InputCheckboxNumber
                                checked={!epubReaderSettings.useDefault_wordSpacing}
                                onChangeCheck={(e) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            useDefault_wordSpacing: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                step={0.1}
                                min={-1}
                                max={5}
                                value={epubReaderSettings.wordSpacing}
                                timeout={[
                                    1000,
                                    (value) => {
                                        makeScrollPos();
                                        dispatch(patchLiveBookReaderSettings({ wordSpacing: value }));
                                    },
                                ]}
                                paraBefore={t("settings.wordSpacing")}
                                paraAfter={t("settings.emUnit")}
                            />
                            <InputCheckboxNumber
                                checked={!epubReaderSettings.useDefault_letterSpacing}
                                onChangeCheck={(e) => {
                                    makeScrollPos();
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            useDefault_letterSpacing: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                step={0.01}
                                min={-1}
                                max={1}
                                value={epubReaderSettings.letterSpacing}
                                timeout={[
                                    1000,
                                    (value) => {
                                        makeScrollPos();
                                        dispatch(patchLiveBookReaderSettings({ letterSpacing: value }));
                                    },
                                ]}
                                paraBefore={t("settings.letterSpacing")}
                                paraAfter={t("settings.emUnit")}
                            />

                            <InputCheckbox
                                checked={!epubReaderSettings.noIndent}
                                onChange={(e) => {
                                    makeScrollPos();
                                    dispatch(patchLiveBookReaderSettings({ noIndent: !e.currentTarget.checked }));
                                }}
                                paraAfter={t("settings.indentation")}
                            />
                            {/* <InputCheckbox
                                    checked={epubReaderSettings.hyphenation}
                                    onChange={(e) => {
                                        dispatch(patchLiveBookReaderSettings({ hyphenation: e.currentTarget.checked }));
                                    }}
                                    paraAfter="Hyphenation"
                                /> */}
                        </div>
                    </BookReaderSettingSection>
                    <BookReaderSettingSection
                        title={t("settings.stylesAndOthers")}
                        collapsedKey="styles"
                        optionsClassName="col"
                    >
                        <InputCheckboxColor
                            checked={!epubReaderSettings.useDefault_fontColor}
                            onChangeCheck={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        useDefault_fontColor: !e.currentTarget.checked,
                                    }),
                                );
                            }}
                            value={colorUtils.new(epubReaderSettings.fontColor)}
                            timeout={[
                                500,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            fontColor: value.hexa(),
                                        }),
                                    ),
                            ]}
                            paraBefore={t("settings.fontColor")}
                        />
                        <InputCheckboxColor
                            checked={!epubReaderSettings.useDefault_linkColor}
                            onChangeCheck={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        useDefault_linkColor: !e.currentTarget.checked,
                                    }),
                                );
                            }}
                            value={colorUtils.new(epubReaderSettings.linkColor)}
                            timeout={[
                                500,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            linkColor: value.hexa(),
                                        }),
                                    ),
                            ]}
                            paraBefore={t("settings.linkColor")}
                        />
                        <InputCheckboxColor
                            checked={!epubReaderSettings.useDefault_backgroundColor}
                            onChangeCheck={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        useDefault_backgroundColor: !e.currentTarget.checked,
                                    }),
                                );
                            }}
                            value={colorUtils.new(epubReaderSettings.backgroundColor)}
                            timeout={[
                                500,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            backgroundColor: value.hexa(),
                                        }),
                                    ),
                            ]}
                            paraBefore={t("settings.pageBackgroundColor")}
                        />
                        <InputCheckbox
                            checked={epubReaderSettings.overrideEpubColors}
                            onChange={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        overrideEpubColors: e.currentTarget.checked,
                                    }),
                                );
                            }}
                            title={t("settings.overrideEpubColorsTitle")}
                            paraAfter={t("settings.overrideEpubColors")}
                        />
                        <InputCheckboxColor
                            checked={!epubReaderSettings.useDefault_progressBackgroundColor}
                            onChangeCheck={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        useDefault_progressBackgroundColor: !e.currentTarget.checked,
                                    }),
                                );
                            }}
                            value={colorUtils.new(epubReaderSettings.progressBackgroundColor)}
                            timeout={[
                                500,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            progressBackgroundColor: value.hexa(),
                                        }),
                                    ),
                            ]}
                            paraBefore={t("settings.progressBackgroundColor")}
                        />
                        <InputCheckbox
                            checked={epubReaderSettings.forceLowBrightness.enabled}
                            onChange={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        forceLowBrightness: {
                                            ...epubReaderSettings.forceLowBrightness,
                                            enabled: e.currentTarget.checked,
                                        },
                                    }),
                                );
                            }}
                            paraAfter={t("settings.forceLowBrightness")}
                        />
                        <InputRange
                            className={"colorRange"}
                            min={0}
                            max={0.9}
                            step={0.05}
                            value={epubReaderSettings.forceLowBrightness.value}
                            disabled={!epubReaderSettings.forceLowBrightness.enabled}
                            labeled={true}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            forceLowBrightness: {
                                                ...epubReaderSettings.forceLowBrightness,
                                                value,
                                            },
                                        }),
                                    ),
                            ]}
                        />
                        <InputCheckbox
                            checked={epubReaderSettings.invertImageColor}
                            onChange={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({ invertImageColor: e.currentTarget.checked }),
                                );
                            }}
                            title={t("settings.invertBlendTitle")}
                            paraAfter={t("settings.invertBlendImage")}
                        />
                        <InputCheckbox
                            checked={epubReaderSettings.showProgressInZenMode}
                            onChange={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        showProgressInZenMode: e.currentTarget.checked,
                                    }),
                                );
                            }}
                            paraAfter={t("settings.showProgressInZen")}
                        />
                    </BookReaderSettingSection>
                    <ContentFrameSettings />
                    <BackgroundSettings />
                    <BookReaderSettingSection
                        title={t("settings.scrollSpeed")}
                        collapsedKey="scrollSpeed"
                        headerTitle={t("settings.scrollSpeedTitleEpub")}
                    >
                        <InputNumber
                            value={epubReaderSettings.scrollSpeedA}
                            min={1}
                            max={500}
                            timeout={[
                                1000,
                                (value) => dispatch(patchLiveBookReaderSettings({ scrollSpeedA: value })),
                            ]}
                            labelBefore={t("settings.scrollAEpub")}
                            labelAfter={t("settings.pxUnit")}
                        />
                        <InputNumber
                            value={epubReaderSettings.scrollSpeedB}
                            min={1}
                            max={500}
                            timeout={[
                                1000,
                                (value) => dispatch(patchLiveBookReaderSettings({ scrollSpeedB: value })),
                            ]}
                            labelBefore={t("settings.scrollBEpub")}
                            labelAfter={t("settings.pxUnit")}
                        />
                    </BookReaderSettingSection>
                </div>
            </div>
        );
    },
);

export default EPUBReaderSettings;
