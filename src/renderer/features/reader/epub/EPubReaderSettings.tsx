import { BookReaderPresetSection } from "@features/reader/components/ReaderPresetSection";
import { faBars, faMinus, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectLiveBookPresetId, selectLiveBookReaderSettings } from "@store/reader";
import { getActiveBookPresetName, patchLiveBookReaderSettings, updateBookPreset } from "@store/readerPresets";
import { getShortcutsMapped } from "@store/shortcuts";
import InputCheckbox from "@ui/InputCheckbox";
import InputCheckboxColor from "@ui/InputCheckboxColor";
import InputCheckboxNumber from "@ui/InputCheckboxNumber";
import InputNumber from "@ui/InputNumber";
import InputRange from "@ui/InputRange";
import InputSelect from "@ui/InputSelect";
import { colorUtils } from "@utils/color";
import { keyFormatter } from "@utils/keybindings";
import { createRendererLogger } from "@utils/logger";
import { memo, useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("epub/EPubReaderSettings");

import BackgroundSettings from "./components/BackgroundSettings";
import ContentFrameSettings from "./components/ContentFrameSettings";

const EPUBReaderSettings = memo(
    ({
        makeScrollPos,
        readerRef,
        readerSettingExtender,
        setShortcutText,
        sizePlusRef,
        sizeMinusRef,
        fontSizePlusRef,
        fontSizeMinusRef,
    }: {
        makeScrollPos: () => void;
        readerRef: React.RefObject<HTMLDivElement>;
        readerSettingExtender: React.RefObject<HTMLButtonElement>;
        setShortcutText: React.Dispatch<React.SetStateAction<string>>;
        sizePlusRef: React.RefObject<HTMLButtonElement>;
        sizeMinusRef: React.RefObject<HTMLButtonElement>;
        fontSizePlusRef: React.RefObject<HTMLButtonElement>;
        fontSizeMinusRef: React.RefObject<HTMLButtonElement>;
    }) => {
        const { t } = useTranslation("reader");
        const appSettings = useAppSelector((store) => store.appSettings);
        const epubReaderSettings = useAppSelector(selectLiveBookReaderSettings);
        const bookPresetId = useAppSelector(selectLiveBookPresetId);
        const shortcutsMapped = useAppSelector(getShortcutsMapped);
        const currentPresetName = useAppSelector(getActiveBookPresetName);
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
        useEffect(() => {
            const f = (e: KeyboardEvent) => {
                if (isReaderSettingsOpen && e.key === "Escape") {
                    setReaderSettingOpen(false);
                    if (readerRef.current) readerRef.current.focus();
                    return;
                }
                const keyStr = keyFormatter(e);
                if (keyStr && shortcutsMapped.savePreset?.includes(keyStr)) {
                    e.preventDefault();
                    const id = bookPresetId;
                    if (id) {
                        dispatch(updateBookPreset({ id, data: epubReaderSettings }));
                        setShortcutText(
                            t("hud.savedToPreset", { name: currentPresetName ?? t("hud.unknownPreset") }),
                        );
                    }
                }
            };
            window.addEventListener("keydown", f);
            return () => window.removeEventListener("keydown", f);
        }, [
            isReaderSettingsOpen,
            shortcutsMapped,
            bookPresetId,
            epubReaderSettings,
            currentPresetName,
            dispatch,
            setShortcutText,
            readerRef,
            t,
        ]);
        return (
            <div
                id="epubReaderSettings"
                className={
                    "readerSettings " +
                    (isReaderSettingsOpen ? "" : "closed ") +
                    (appSettings.checkboxReaderSetting ? "checkboxSetting " : "")
                }
                onKeyDown={(e) => {
                    if (e.key === "Escape" || e.key === "q") {
                        e.stopPropagation();
                        setReaderSettingOpen(false);
                        if (readerRef.current) readerRef.current.focus();
                    }
                }}
            >
                <button
                    className="menuExtender"
                    ref={readerSettingExtender}
                    onClick={() => setReaderSettingOpen((init) => !init)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape" || e.key === "q") e.currentTarget.blur();
                    }}
                    {...(!isReaderSettingsOpen ? { "data-tooltip": t("settings.readerSettingsTooltip") } : {})}
                >
                    <FontAwesomeIcon icon={isReaderSettingsOpen ? faTimes : faBars} />
                </button>
                <div className="main">
                    <BookReaderPresetSection />
                    <div className="settingItem">
                        <div
                            className={`name ${!epubReaderSettings.settingsCollapsed.size ? "expanded " : ""}`}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        settingsCollapsed: {
                                            ...epubReaderSettings.settingsCollapsed,
                                            size: !epubReaderSettings.settingsCollapsed.size,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.size")}
                        </div>
                        <div className="options">
                            <InputNumber
                                value={epubReaderSettings.readerWidth}
                                min={1}
                                max={maxWidth}
                                // onChange={(e) => {
                                // makeScrollPos();
                                // }}
                                timeout={[
                                    1000,
                                    (value) => dispatch(patchLiveBookReaderSettings({ readerWidth: value })),
                                ]}
                                labelAfter={t("settings.percentUnit")}
                            />
                            <button
                                ref={sizeMinusRef}
                                onClick={(e) => {
                                    // makeScrollPos();
                                    // was 20 before
                                    const steps = epubReaderSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        epubReaderSettings.readerWidth - steps > maxWidth
                                            ? maxWidth
                                            : epubReaderSettings.readerWidth - steps < 1
                                              ? 1
                                              : epubReaderSettings.readerWidth - steps;
                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(patchLiveBookReaderSettings({ readerWidth }));
                                    // e.currentTarget.dispatchEvent(new MouseEvent(type:"")))
                                }}
                            >
                                <FontAwesomeIcon icon={faMinus} />
                            </button>
                            <button
                                ref={sizePlusRef}
                                onClick={(e) => {
                                    // makeScrollPos();
                                    const steps = epubReaderSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        epubReaderSettings.readerWidth + steps > maxWidth
                                            ? maxWidth
                                            : epubReaderSettings.readerWidth + steps < 1
                                              ? 1
                                              : epubReaderSettings.readerWidth + steps;

                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(patchLiveBookReaderSettings({ readerWidth }));
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                            <div className="col">
                                <InputCheckbox
                                    checked={epubReaderSettings.limitImgHeight}
                                    onChange={(e) => {
                                        // makeScrollPos();
                                        dispatch(
                                            patchLiveBookReaderSettings({
                                                limitImgHeight: e.currentTarget.checked,
                                            }),
                                        );
                                    }}
                                    paraAfter={t("settings.limitImgHeight")}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div
                            className={`name ${!epubReaderSettings.settingsCollapsed.font ? "expanded " : ""}`}
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        settingsCollapsed: {
                                            ...epubReaderSettings.settingsCollapsed,
                                            font: !epubReaderSettings.settingsCollapsed.font,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.fontAndLayout")}
                        </div>
                        <div className="options">
                            <div className="row">
                                <InputNumber
                                    value={epubReaderSettings.fontSize}
                                    min={1}
                                    max={100}
                                    // onChange={(e) => {
                                    // makeScrollPos();
                                    // }}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(patchLiveBookReaderSettings({ fontSize: value })),
                                    ]}
                                    labelAfter={t("settings.pxUnit")}
                                />
                                <button
                                    ref={fontSizeMinusRef}
                                    onClick={(e) => {
                                        // makeScrollPos();
                                        let newSize = epubReaderSettings.fontSize - 1;

                                        newSize = newSize < 1 ? 1 : newSize;
                                        if (document.activeElement !== e.currentTarget)
                                            setShortcutText(`${newSize}px`);
                                        dispatch(patchLiveBookReaderSettings({ fontSize: newSize }));
                                    }}
                                >
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <button
                                    ref={fontSizePlusRef}
                                    onClick={(e) => {
                                        // makeScrollPos();
                                        let newSize = epubReaderSettings.fontSize + 1;

                                        newSize = newSize > 100 ? 100 : newSize;
                                        if (document.activeElement !== e.currentTarget)
                                            setShortcutText(`${newSize}px`);
                                        dispatch(patchLiveBookReaderSettings({ fontSize: newSize }));
                                    }}
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                            <div className="col">
                                <InputCheckbox
                                    checked={!epubReaderSettings.useDefault_fontFamily}
                                    onChange={(e) => {
                                        // makeScrollPos();
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
                                        // makeScrollPos();
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
                                            epubReaderSettings.quickFontFamily.includes(
                                                epubReaderSettings.fontFamily,
                                            )
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
                                        (value) =>
                                            dispatch(
                                                patchLiveBookReaderSettings({
                                                    fontWeight: value,
                                                }),
                                            ),
                                    ]}
                                />
                                <InputCheckboxNumber
                                    checked={!epubReaderSettings.useDefault_lineSpacing}
                                    onChangeCheck={(e) => {
                                        // makeScrollPos();
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
                                        (value) => dispatch(patchLiveBookReaderSettings({ lineSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.lineHeight")}
                                    paraAfter={t("settings.emUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={!epubReaderSettings.useDefault_paragraphSpacing}
                                    onChangeCheck={(e) => {
                                        // makeScrollPos();
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
                                        (value) =>
                                            dispatch(patchLiveBookReaderSettings({ paragraphSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.paragraphSpacing")}
                                    paraAfter={t("settings.emUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={!epubReaderSettings.useDefault_wordSpacing}
                                    onChangeCheck={(e) => {
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
                                        (value) => dispatch(patchLiveBookReaderSettings({ wordSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.wordSpacing")}
                                    paraAfter={t("settings.emUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={!epubReaderSettings.useDefault_letterSpacing}
                                    onChangeCheck={(e) => {
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
                                        (value) => dispatch(patchLiveBookReaderSettings({ letterSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.letterSpacing")}
                                    paraAfter={t("settings.emUnit")}
                                />

                                <InputCheckbox
                                    checked={!epubReaderSettings.noIndent}
                                    onChange={(e) => {
                                        dispatch(
                                            patchLiveBookReaderSettings({ noIndent: !e.currentTarget.checked }),
                                        );
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
                        </div>
                    </div>
                    <div className="settingItem">
                        <div
                            className={`name ${!epubReaderSettings.settingsCollapsed.styles ? "expanded " : ""}`}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        settingsCollapsed: {
                                            ...epubReaderSettings.settingsCollapsed,
                                            styles: !epubReaderSettings.settingsCollapsed.styles,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.stylesAndOthers")}
                        </div>
                        <div className="options col">
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
                        </div>
                    </div>
                    <ContentFrameSettings />
                    <BackgroundSettings />
                    <div className="settingItem">
                        <div
                            className={`name ${!epubReaderSettings.settingsCollapsed.scrollSpeed ? "expanded " : ""}`}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        settingsCollapsed: {
                                            ...epubReaderSettings.settingsCollapsed,
                                            scrollSpeed: !epubReaderSettings.settingsCollapsed.scrollSpeed,
                                        },
                                    }),
                                );
                            }}
                            title={t("settings.scrollSpeedTitleEpub")}
                        >
                            {t("settings.scrollSpeed")}
                        </div>
                        <div className="options">
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
                        </div>
                    </div>
                </div>
            </div>
        );
    },
);

export default EPUBReaderSettings;
