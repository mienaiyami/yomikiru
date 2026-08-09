import { BookReaderPresetSection } from "@features/reader/components/ReaderPresetSection";
import { faBars, faMinus, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { setEpubReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { getActiveBookPresetName, updateBookPreset } from "@store/readerPresets";
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
                    const id = appSettings.bookReaderPresetId;
                    if (id) {
                        dispatch(updateBookPreset({ id, data: appSettings.epubReaderSettings }));
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
            appSettings.bookReaderPresetId,
            appSettings.epubReaderSettings,
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
                            className={
                                "name " +
                                (!appSettings.epubReaderSettings.settingsCollapsed.size ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setEpubReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.epubReaderSettings.settingsCollapsed,
                                            size: !appSettings.epubReaderSettings.settingsCollapsed.size,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.size")}
                        </div>
                        <div className="options">
                            <InputNumber
                                value={appSettings.epubReaderSettings.readerWidth}
                                min={1}
                                max={maxWidth}
                                // onChange={(e) => {
                                // makeScrollPos();
                                // }}
                                timeout={[
                                    1000,
                                    (value) => dispatch(setEpubReaderSettings({ readerWidth: value })),
                                ]}
                                labelAfter={t("settings.percentUnit")}
                            />
                            <button
                                ref={sizeMinusRef}
                                onClick={(e) => {
                                    // makeScrollPos();
                                    // was 20 before
                                    const steps = appSettings.epubReaderSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        appSettings.epubReaderSettings.readerWidth - steps > maxWidth
                                            ? maxWidth
                                            : appSettings.epubReaderSettings.readerWidth - steps < 1
                                              ? 1
                                              : appSettings.epubReaderSettings.readerWidth - steps;
                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(setEpubReaderSettings({ readerWidth }));
                                    // e.currentTarget.dispatchEvent(new MouseEvent(type:"")))
                                }}
                            >
                                <FontAwesomeIcon icon={faMinus} />
                            </button>
                            <button
                                ref={sizePlusRef}
                                onClick={(e) => {
                                    // makeScrollPos();
                                    const steps = appSettings.epubReaderSettings.readerWidth <= 40 ? 5 : 10;
                                    const readerWidth =
                                        appSettings.epubReaderSettings.readerWidth + steps > maxWidth
                                            ? maxWidth
                                            : appSettings.epubReaderSettings.readerWidth + steps < 1
                                              ? 1
                                              : appSettings.epubReaderSettings.readerWidth + steps;

                                    if (document.activeElement !== e.currentTarget)
                                        setShortcutText(`${readerWidth}%`);
                                    dispatch(setEpubReaderSettings({ readerWidth }));
                                }}
                            >
                                <FontAwesomeIcon icon={faPlus} />
                            </button>
                            <div className="col">
                                <InputCheckbox
                                    checked={appSettings.epubReaderSettings.limitImgHeight}
                                    onChange={(e) => {
                                        // makeScrollPos();
                                        dispatch(
                                            setEpubReaderSettings({
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
                            className={
                                "name " +
                                (!appSettings.epubReaderSettings.settingsCollapsed.font ? "expanded " : "")
                            }
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setEpubReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.epubReaderSettings.settingsCollapsed,
                                            font: !appSettings.epubReaderSettings.settingsCollapsed.font,
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
                                    value={appSettings.epubReaderSettings.fontSize}
                                    min={1}
                                    max={100}
                                    // onChange={(e) => {
                                    // makeScrollPos();
                                    // }}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(setEpubReaderSettings({ fontSize: value })),
                                    ]}
                                    labelAfter={t("settings.pxUnit")}
                                />
                                <button
                                    ref={fontSizeMinusRef}
                                    onClick={(e) => {
                                        // makeScrollPos();
                                        let newSize = appSettings.epubReaderSettings.fontSize - 1;

                                        newSize = newSize < 1 ? 1 : newSize;
                                        if (document.activeElement !== e.currentTarget)
                                            setShortcutText(`${newSize}px`);
                                        dispatch(setEpubReaderSettings({ fontSize: newSize }));
                                    }}
                                >
                                    <FontAwesomeIcon icon={faMinus} />
                                </button>
                                <button
                                    ref={fontSizePlusRef}
                                    onClick={(e) => {
                                        // makeScrollPos();
                                        let newSize = appSettings.epubReaderSettings.fontSize + 1;

                                        newSize = newSize > 100 ? 100 : newSize;
                                        if (document.activeElement !== e.currentTarget)
                                            setShortcutText(`${newSize}px`);
                                        dispatch(setEpubReaderSettings({ fontSize: newSize }));
                                    }}
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                </button>
                            </div>
                            <div className="col">
                                <InputCheckbox
                                    checked={!appSettings.epubReaderSettings.useDefault_fontFamily}
                                    onChange={(e) => {
                                        // makeScrollPos();
                                        dispatch(
                                            setEpubReaderSettings({
                                                useDefault_fontFamily: !e.currentTarget.checked,
                                            }),
                                        );
                                    }}
                                    paraAfter={t("settings.customFontFamily")}
                                />
                                <InputSelect
                                    disabled={appSettings.epubReaderSettings.useDefault_fontFamily}
                                    value={appSettings.epubReaderSettings.fontFamily}
                                    onChange={(value) => {
                                        // makeScrollPos();
                                        dispatch(
                                            setEpubReaderSettings({
                                                fontFamily: value,
                                            }),
                                        );
                                    }}
                                    options={[
                                        ...appSettings.epubReaderSettings.quickFontFamily.map(
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
                                    disabled={appSettings.epubReaderSettings.useDefault_fontFamily}
                                    onClick={() => {
                                        if (
                                            appSettings.epubReaderSettings.quickFontFamily.includes(
                                                appSettings.epubReaderSettings.fontFamily,
                                            )
                                        ) {
                                            dispatch(
                                                setEpubReaderSettings({
                                                    quickFontFamily:
                                                        appSettings.epubReaderSettings.quickFontFamily.filter(
                                                            (e) => e !== appSettings.epubReaderSettings.fontFamily,
                                                        ),
                                                }),
                                            );
                                        } else {
                                            dispatch(
                                                setEpubReaderSettings({
                                                    quickFontFamily: [
                                                        ...appSettings.epubReaderSettings.quickFontFamily,
                                                        appSettings.epubReaderSettings.fontFamily,
                                                    ],
                                                }),
                                            );
                                        }
                                    }}
                                >
                                    {appSettings.epubReaderSettings.quickFontFamily.includes(
                                        appSettings.epubReaderSettings.fontFamily,
                                    )
                                        ? t("settings.removeStar")
                                        : t("settings.starFontFamily")}
                                </button>
                                <InputCheckbox
                                    checked={!appSettings.epubReaderSettings.useDefault_fontWeight}
                                    onChange={(e) => {
                                        dispatch(
                                            setEpubReaderSettings({
                                                useDefault_fontWeight: !e.currentTarget.checked,
                                            }),
                                        );
                                    }}
                                    title={t("settings.fontWeightTitle")}
                                    paraAfter={t("settings.fontWeight")}
                                />
                                <InputRange
                                    value={appSettings.epubReaderSettings.fontWeight}
                                    disabled={appSettings.epubReaderSettings.useDefault_fontWeight}
                                    min={100}
                                    max={900}
                                    step={100}
                                    labeled
                                    labelText=""
                                    timeout={[
                                        350,
                                        (value) =>
                                            dispatch(
                                                setEpubReaderSettings({
                                                    fontWeight: value,
                                                }),
                                            ),
                                    ]}
                                />
                                <InputCheckboxNumber
                                    checked={!appSettings.epubReaderSettings.useDefault_lineSpacing}
                                    onChangeCheck={(e) => {
                                        // makeScrollPos();
                                        dispatch(
                                            setEpubReaderSettings({
                                                useDefault_lineSpacing: !e.currentTarget.checked,
                                            }),
                                        );
                                    }}
                                    step={0.1}
                                    min={0}
                                    max={10}
                                    value={appSettings.epubReaderSettings.lineSpacing}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(setEpubReaderSettings({ lineSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.lineHeight")}
                                    paraAfter={t("settings.emUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={!appSettings.epubReaderSettings.useDefault_paragraphSpacing}
                                    onChangeCheck={(e) => {
                                        // makeScrollPos();
                                        dispatch(
                                            setEpubReaderSettings({
                                                useDefault_paragraphSpacing: !e.currentTarget.checked,
                                            }),
                                        );
                                    }}
                                    step={0.1}
                                    min={0}
                                    max={10}
                                    value={appSettings.epubReaderSettings.paragraphSpacing}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(setEpubReaderSettings({ paragraphSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.paragraphSpacing")}
                                    paraAfter={t("settings.emUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={!appSettings.epubReaderSettings.useDefault_wordSpacing}
                                    onChangeCheck={(e) => {
                                        dispatch(
                                            setEpubReaderSettings({
                                                useDefault_wordSpacing: !e.currentTarget.checked,
                                            }),
                                        );
                                    }}
                                    step={0.1}
                                    min={-1}
                                    max={5}
                                    value={appSettings.epubReaderSettings.wordSpacing}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(setEpubReaderSettings({ wordSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.wordSpacing")}
                                    paraAfter={t("settings.emUnit")}
                                />
                                <InputCheckboxNumber
                                    checked={!appSettings.epubReaderSettings.useDefault_letterSpacing}
                                    onChangeCheck={(e) => {
                                        dispatch(
                                            setEpubReaderSettings({
                                                useDefault_letterSpacing: !e.currentTarget.checked,
                                            }),
                                        );
                                    }}
                                    step={0.01}
                                    min={-1}
                                    max={1}
                                    value={appSettings.epubReaderSettings.letterSpacing}
                                    timeout={[
                                        1000,
                                        (value) => dispatch(setEpubReaderSettings({ letterSpacing: value })),
                                    ]}
                                    paraBefore={t("settings.letterSpacing")}
                                    paraAfter={t("settings.emUnit")}
                                />

                                <InputCheckbox
                                    checked={!appSettings.epubReaderSettings.noIndent}
                                    onChange={(e) => {
                                        dispatch(setEpubReaderSettings({ noIndent: !e.currentTarget.checked }));
                                    }}
                                    paraAfter={t("settings.indentation")}
                                />
                                {/* <InputCheckbox
                                    checked={appSettings.epubReaderSettings.hyphenation}
                                    onChange={(e) => {
                                        dispatch(setEpubReaderSettings({ hyphenation: e.currentTarget.checked }));
                                    }}
                                    paraAfter="Hyphenation"
                                /> */}
                            </div>
                        </div>
                    </div>
                    <div className="settingItem">
                        <div
                            className={
                                "name " +
                                (!appSettings.epubReaderSettings.settingsCollapsed.styles ? "expanded " : "")
                            }
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setEpubReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.epubReaderSettings.settingsCollapsed,
                                            styles: !appSettings.epubReaderSettings.settingsCollapsed.styles,
                                        },
                                    }),
                                );
                            }}
                        >
                            {t("settings.stylesAndOthers")}
                        </div>
                        <div className="options col">
                            <InputCheckboxColor
                                checked={!appSettings.epubReaderSettings.useDefault_fontColor}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            useDefault_fontColor: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                value={colorUtils.new(appSettings.epubReaderSettings.fontColor)}
                                timeout={[
                                    500,
                                    (value) =>
                                        dispatch(
                                            setEpubReaderSettings({
                                                fontColor: value.hexa(),
                                            }),
                                        ),
                                ]}
                                paraBefore={t("settings.fontColor")}
                            />
                            <InputCheckboxColor
                                checked={!appSettings.epubReaderSettings.useDefault_linkColor}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            useDefault_linkColor: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                value={colorUtils.new(appSettings.epubReaderSettings.linkColor)}
                                timeout={[
                                    500,
                                    (value) =>
                                        dispatch(
                                            setEpubReaderSettings({
                                                linkColor: value.hexa(),
                                            }),
                                        ),
                                ]}
                                paraBefore={t("settings.linkColor")}
                            />
                            <InputCheckboxColor
                                checked={!appSettings.epubReaderSettings.useDefault_backgroundColor}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            useDefault_backgroundColor: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                value={colorUtils.new(appSettings.epubReaderSettings.backgroundColor)}
                                timeout={[
                                    500,
                                    (value) =>
                                        dispatch(
                                            setEpubReaderSettings({
                                                backgroundColor: value.hexa(),
                                            }),
                                        ),
                                ]}
                                paraBefore={t("settings.pageBackgroundColor")}
                            />
                            <InputCheckbox
                                checked={appSettings.epubReaderSettings.overrideEpubColors}
                                onChange={(e) => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            overrideEpubColors: e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                title={t("settings.overrideEpubColorsTitle")}
                                paraAfter={t("settings.overrideEpubColors")}
                            />
                            <InputCheckboxColor
                                checked={!appSettings.epubReaderSettings.useDefault_progressBackgroundColor}
                                onChangeCheck={(e) => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            useDefault_progressBackgroundColor: !e.currentTarget.checked,
                                        }),
                                    );
                                }}
                                value={colorUtils.new(appSettings.epubReaderSettings.progressBackgroundColor)}
                                timeout={[
                                    500,
                                    (value) =>
                                        dispatch(
                                            setEpubReaderSettings({
                                                progressBackgroundColor: value.hexa(),
                                            }),
                                        ),
                                ]}
                                paraBefore={t("settings.progressBackgroundColor")}
                            />
                            <InputCheckbox
                                checked={appSettings.epubReaderSettings.forceLowBrightness.enabled}
                                onChange={(e) => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            forceLowBrightness: {
                                                ...appSettings.epubReaderSettings.forceLowBrightness,
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
                                value={appSettings.epubReaderSettings.forceLowBrightness.value}
                                disabled={!appSettings.epubReaderSettings.forceLowBrightness.enabled}
                                labeled={true}
                                timeout={[
                                    350,
                                    (value) =>
                                        dispatch(
                                            setEpubReaderSettings({
                                                forceLowBrightness: {
                                                    ...appSettings.epubReaderSettings.forceLowBrightness,
                                                    value,
                                                },
                                            }),
                                        ),
                                ]}
                            />
                            <InputCheckbox
                                checked={appSettings.epubReaderSettings.invertImageColor}
                                onChange={(e) => {
                                    dispatch(setEpubReaderSettings({ invertImageColor: e.currentTarget.checked }));
                                }}
                                title={t("settings.invertBlendTitle")}
                                paraAfter={t("settings.invertBlendImage")}
                            />
                            <InputCheckbox
                                checked={appSettings.epubReaderSettings.showProgressInZenMode}
                                onChange={(e) => {
                                    dispatch(
                                        setEpubReaderSettings({ showProgressInZenMode: e.currentTarget.checked }),
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
                            className={
                                "name " +
                                (!appSettings.epubReaderSettings.settingsCollapsed.scrollSpeed ? "expanded " : "")
                            }
                            onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                            }}
                            onClick={() => {
                                dispatch(
                                    setEpubReaderSettings({
                                        settingsCollapsed: {
                                            ...appSettings.epubReaderSettings.settingsCollapsed,
                                            scrollSpeed:
                                                !appSettings.epubReaderSettings.settingsCollapsed.scrollSpeed,
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
                                value={appSettings.epubReaderSettings.scrollSpeedA}
                                min={1}
                                max={500}
                                timeout={[
                                    1000,
                                    (value) => dispatch(setEpubReaderSettings({ scrollSpeedA: value })),
                                ]}
                                labelBefore={t("settings.scrollAEpub")}
                                labelAfter={t("settings.pxUnit")}
                            />
                            <InputNumber
                                value={appSettings.epubReaderSettings.scrollSpeedB}
                                min={1}
                                max={500}
                                timeout={[
                                    1000,
                                    (value) => dispatch(setEpubReaderSettings({ scrollSpeedB: value })),
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
