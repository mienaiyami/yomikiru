import { setEpubReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import InputCheckbox from "@ui/InputCheckbox";
import InputCheckboxColor from "@ui/InputCheckboxColor";
import InputColor from "@ui/InputColor";
import InputNumber from "@ui/InputNumber";
import InputSelect from "@ui/InputSelect";
import { colorUtils } from "@utils/color";
import type { BookReaderSettings } from "@utils/readerSettingsSchema";
import { memo } from "react";
import { useTranslation } from "react-i18next";

/**
 * EPUB reader: content column padding and border (see `contentFrame` in book reader settings).
 */
const ContentFrameSettings = memo(() => {
    const { t } = useTranslation("reader");
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    const cf = appSettings.epubReaderSettings.contentFrame;
    const border = cf.border;
    const borderStyleOptions: Menu.OptSelectOption[] = [
        { label: t("settings.borderSolid"), value: "solid" },
        { label: t("settings.borderDashed"), value: "dashed" },
        { label: t("settings.borderDotted"), value: "dotted" },
        { label: t("settings.borderDouble"), value: "double" },
    ];

    return (
        <div className="settingItem">
            <div
                className={`name ${!appSettings.epubReaderSettings.settingsCollapsed.contentFrame ? "expanded " : ""}`}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                }}
                onClick={() => {
                    dispatch(
                        setEpubReaderSettings({
                            settingsCollapsed: {
                                ...appSettings.epubReaderSettings.settingsCollapsed,
                                contentFrame: !appSettings.epubReaderSettings.settingsCollapsed.contentFrame,
                            },
                        }),
                    );
                }}
            >
                {t("settings.contentFrame")}
            </div>
            <div className="options col">
                <InputCheckboxColor
                    checked={!cf.useDefault_contentBackgroundColor}
                    onChangeCheck={(e) => {
                        dispatch(
                            setEpubReaderSettings({
                                contentFrame: {
                                    ...cf,
                                    useDefault_contentBackgroundColor: !e.currentTarget.checked,
                                },
                            }),
                        );
                    }}
                    value={colorUtils.new(cf.contentBackgroundColor)}
                    timeout={[
                        500,
                        (value) =>
                            dispatch(
                                setEpubReaderSettings({
                                    contentFrame: {
                                        ...cf,
                                        contentBackgroundColor: value.hexa(),
                                    },
                                }),
                            ),
                    ]}
                    paraBefore={t("settings.contentBackgroundColor")}
                />
                <InputNumber
                    value={cf.paddingInline}
                    min={0}
                    max={200}
                    timeout={[
                        1000,
                        (value) =>
                            dispatch(
                                setEpubReaderSettings({
                                    contentFrame: {
                                        ...cf,
                                        paddingInline: value,
                                    },
                                }),
                            ),
                    ]}
                    paraBefore={t("settings.horizontalSpacing")}
                    paraAfter={t("settings.pxUnit")}
                />
                <InputCheckbox
                    checked={border.enabled}
                    onChange={(e) => {
                        dispatch(
                            setEpubReaderSettings({
                                contentFrame: {
                                    ...cf,
                                    border: {
                                        ...border,
                                        enabled: e.currentTarget.checked,
                                    },
                                },
                            }),
                        );
                    }}
                    labelAfter={t("settings.contentBorder")}
                />
                <InputNumber
                    value={border.width}
                    min={0}
                    max={32}
                    disabled={!border.enabled}
                    timeout={[
                        1000,
                        (value) =>
                            dispatch(
                                setEpubReaderSettings({
                                    contentFrame: {
                                        ...cf,
                                        border: {
                                            ...border,
                                            width: value,
                                        },
                                    },
                                }),
                            ),
                    ]}
                    paraBefore={t("settings.borderWidth")}
                    paraAfter={t("settings.pxUnit")}
                />
                <InputSelect
                    labeled
                    disabled={!border.enabled}
                    value={border.style}
                    onChange={(value) => {
                        dispatch(
                            setEpubReaderSettings({
                                contentFrame: {
                                    ...cf,
                                    border: {
                                        ...border,
                                        style: value as BookReaderSettings["contentFrame"]["border"]["style"],
                                    },
                                },
                            }),
                        );
                    }}
                    options={borderStyleOptions}
                    paraBefore={t("settings.borderStyle")}
                />
                <InputColor
                    labeled
                    value={colorUtils.new(border.color)}
                    disabled={!border.enabled}
                    timeout={[
                        500,
                        (value) =>
                            dispatch(
                                setEpubReaderSettings({
                                    contentFrame: {
                                        ...cf,
                                        border: {
                                            ...border,
                                            color: value.hexa(),
                                        },
                                    },
                                }),
                            ),
                    ]}
                    paraBefore={t("settings.borderColor")}
                />
            </div>
        </div>
    );
});

ContentFrameSettings.displayName = "ContentFrameSettings";

export default ContentFrameSettings;
