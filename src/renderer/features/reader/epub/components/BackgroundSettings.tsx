import { setEpubReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import InputCheckbox from "@ui/InputCheckbox";
import InputColor from "@ui/InputColor";
import InputRange from "@ui/InputRange";
import { colorUtils } from "@utils/color";
import { promptSelectDir } from "@utils/file";
import { defaultSettings } from "@utils/settingsSchema";
import { memo } from "react";
import { useTranslation } from "react-i18next";

const BackgroundSettings = memo(() => {
    const { t } = useTranslation("reader");
    const { t: tSettings } = useTranslation("settings");
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();

    return (
        <div className="settingItem">
            <div
                className={`name ${!appSettings.epubReaderSettings.settingsCollapsed.background ? "expanded " : ""}`}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                }}
                onClick={() => {
                    dispatch(
                        setEpubReaderSettings({
                            settingsCollapsed: {
                                ...appSettings.epubReaderSettings.settingsCollapsed,
                                background: !appSettings.epubReaderSettings.settingsCollapsed.background,
                            },
                        }),
                    );
                }}
            >
                {t("settings.backgroundImage")}
            </div>
            <div className="options col">
                <InputCheckbox
                    checked={appSettings.epubReaderSettings.backgroundImage.enabled}
                    onChange={(e) => {
                        dispatch(
                            setEpubReaderSettings({
                                backgroundImage: {
                                    ...appSettings.epubReaderSettings.backgroundImage,
                                    enabled: e.currentTarget.checked,
                                },
                            }),
                        );
                    }}
                    labelAfter={t("settings.useBackgroundImage")}
                />
                {appSettings.epubReaderSettings.backgroundImage.enabled && (
                    <>
                        <div className="row">
                            <input
                                type="text"
                                placeholder={t("settings.noImageSelected")}
                                value={appSettings.epubReaderSettings.backgroundImage.path}
                                readOnly
                            />
                        </div>
                        <div className="row">
                            <button
                                onClick={() => {
                                    promptSelectDir(
                                        (path) => {
                                            dispatch(
                                                setEpubReaderSettings({
                                                    backgroundImage: {
                                                        ...appSettings.epubReaderSettings.backgroundImage,
                                                        path: path as string,
                                                    },
                                                }),
                                            );
                                        },
                                        true,
                                        [
                                            {
                                                extensions: ["jpg", "jpeg", "png", "webp", "gif", "svg"],
                                                name: t("settings.imagesFilter"),
                                            },
                                        ],
                                    );
                                }}
                            >
                                {tSettings("shared.select")}
                            </button>
                            <button
                                onClick={() => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            backgroundImage: {
                                                ...appSettings.epubReaderSettings.backgroundImage,
                                                path: "",
                                            },
                                        }),
                                    );
                                }}
                            >
                                {tSettings("shared.clear")}
                            </button>
                            <button
                                onClick={() => {
                                    dispatch(
                                        setEpubReaderSettings({
                                            backgroundImage: {
                                                ...defaultSettings.epubReaderSettings.backgroundImage,
                                                enabled: appSettings.epubReaderSettings.backgroundImage.enabled,
                                            },
                                        }),
                                    );
                                }}
                            >
                                {tSettings("shared.reset")}
                            </button>
                        </div>
                        <InputRange
                            min={0}
                            max={100}
                            step={5}
                            value={appSettings.epubReaderSettings.backgroundImage.dimIntensity}
                            labeled
                            labelText={t("settings.dimIntensity")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        setEpubReaderSettings({
                                            backgroundImage: {
                                                ...appSettings.epubReaderSettings.backgroundImage,
                                                dimIntensity: value,
                                            },
                                        }),
                                    ),
                            ]}
                        />
                        <InputRange
                            min={50}
                            max={150}
                            step={5}
                            value={appSettings.epubReaderSettings.backgroundImage.brightness}
                            labeled
                            labelText={t("settings.brightnessLabel")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        setEpubReaderSettings({
                                            backgroundImage: {
                                                ...appSettings.epubReaderSettings.backgroundImage,
                                                brightness: value,
                                            },
                                        }),
                                    ),
                            ]}
                        />
                        <InputRange
                            min={50}
                            max={150}
                            step={5}
                            value={appSettings.epubReaderSettings.backgroundImage.contrast}
                            labeled
                            labelText={t("settings.contrastLabel")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        setEpubReaderSettings({
                                            backgroundImage: {
                                                ...appSettings.epubReaderSettings.backgroundImage,
                                                contrast: value,
                                            },
                                        }),
                                    ),
                            ]}
                        />
                        <InputCheckbox
                            checked={appSettings.epubReaderSettings.backgroundImage.layer.enabled}
                            onChange={(e) => {
                                dispatch(
                                    setEpubReaderSettings({
                                        backgroundImage: {
                                            ...appSettings.epubReaderSettings.backgroundImage,
                                            layer: {
                                                ...appSettings.epubReaderSettings.backgroundImage.layer,
                                                enabled: e.currentTarget.checked,
                                            },
                                        },
                                    }),
                                );
                            }}
                            labelAfter={t("settings.imageLayerOverlay")}
                        />

                        <InputColor
                            labeled
                            disabled={!appSettings.epubReaderSettings.backgroundImage.layer.enabled}
                            value={colorUtils.new(appSettings.epubReaderSettings.backgroundImage.layer.color)}
                            timeout={[
                                500,
                                (value) =>
                                    dispatch(
                                        setEpubReaderSettings({
                                            backgroundImage: {
                                                ...appSettings.epubReaderSettings.backgroundImage,
                                                layer: {
                                                    ...appSettings.epubReaderSettings.backgroundImage.layer,
                                                    color: value.hexa(),
                                                },
                                            },
                                        }),
                                    ),
                            ]}
                            paraBefore={t("settings.layerColor")}
                        />
                        <InputRange
                            min={0}
                            max={1}
                            step={0.05}
                            disabled={!appSettings.epubReaderSettings.backgroundImage.layer.enabled}
                            value={appSettings.epubReaderSettings.backgroundImage.layer.opacity}
                            labeled
                            labelText={t("settings.layerOpacity")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        setEpubReaderSettings({
                                            backgroundImage: {
                                                ...appSettings.epubReaderSettings.backgroundImage,
                                                layer: {
                                                    ...appSettings.epubReaderSettings.backgroundImage.layer,
                                                    opacity: value,
                                                },
                                            },
                                        }),
                                    ),
                            ]}
                        />
                    </>
                )}
            </div>
        </div>
    );
});

BackgroundSettings.displayName = "BackgroundSettings";

export default BackgroundSettings;
