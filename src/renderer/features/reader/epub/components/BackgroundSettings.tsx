import { useAppDispatch, useAppSelector } from "@store/hooks";
import { selectLiveBookReaderSettings } from "@store/reader";
import { patchLiveBookReaderSettings } from "@store/readerPresets";
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
    const epubReaderSettings = useAppSelector(selectLiveBookReaderSettings);
    const dispatch = useAppDispatch();

    return (
        <div className="settingItem">
            <div
                className={`name ${!epubReaderSettings.settingsCollapsed.background ? "expanded " : ""}`}
                onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") e.currentTarget.click();
                }}
                onClick={() => {
                    dispatch(
                        patchLiveBookReaderSettings({
                            settingsCollapsed: {
                                ...epubReaderSettings.settingsCollapsed,
                                background: !epubReaderSettings.settingsCollapsed.background,
                            },
                        }),
                    );
                }}
            >
                {t("settings.backgroundImage")}
            </div>
            <div className="options col">
                <InputCheckbox
                    checked={epubReaderSettings.backgroundImage.enabled}
                    onChange={(e) => {
                        dispatch(
                            patchLiveBookReaderSettings({
                                backgroundImage: {
                                    ...epubReaderSettings.backgroundImage,
                                    enabled: e.currentTarget.checked,
                                },
                            }),
                        );
                    }}
                    labelAfter={t("settings.useBackgroundImage")}
                />
                {epubReaderSettings.backgroundImage.enabled && (
                    <>
                        <div className="row">
                            <input
                                type="text"
                                placeholder={t("settings.noImageSelected")}
                                value={epubReaderSettings.backgroundImage.path}
                                readOnly
                            />
                        </div>
                        <div className="row">
                            <button
                                onClick={() => {
                                    promptSelectDir(
                                        (path) => {
                                            dispatch(
                                                patchLiveBookReaderSettings({
                                                    backgroundImage: {
                                                        ...epubReaderSettings.backgroundImage,
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
                                        patchLiveBookReaderSettings({
                                            backgroundImage: {
                                                ...epubReaderSettings.backgroundImage,
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
                                        patchLiveBookReaderSettings({
                                            backgroundImage: {
                                                ...defaultSettings.epubReaderSettings.backgroundImage,
                                                enabled: epubReaderSettings.backgroundImage.enabled,
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
                            value={epubReaderSettings.backgroundImage.dimIntensity}
                            labeled
                            labelText={t("settings.dimIntensity")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            backgroundImage: {
                                                ...epubReaderSettings.backgroundImage,
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
                            value={epubReaderSettings.backgroundImage.brightness}
                            labeled
                            labelText={t("settings.brightnessLabel")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            backgroundImage: {
                                                ...epubReaderSettings.backgroundImage,
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
                            value={epubReaderSettings.backgroundImage.contrast}
                            labeled
                            labelText={t("settings.contrastLabel")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            backgroundImage: {
                                                ...epubReaderSettings.backgroundImage,
                                                contrast: value,
                                            },
                                        }),
                                    ),
                            ]}
                        />
                        <InputCheckbox
                            checked={epubReaderSettings.backgroundImage.layer.enabled}
                            onChange={(e) => {
                                dispatch(
                                    patchLiveBookReaderSettings({
                                        backgroundImage: {
                                            ...epubReaderSettings.backgroundImage,
                                            layer: {
                                                ...epubReaderSettings.backgroundImage.layer,
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
                            disabled={!epubReaderSettings.backgroundImage.layer.enabled}
                            value={colorUtils.new(epubReaderSettings.backgroundImage.layer.color)}
                            timeout={[
                                500,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            backgroundImage: {
                                                ...epubReaderSettings.backgroundImage,
                                                layer: {
                                                    ...epubReaderSettings.backgroundImage.layer,
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
                            disabled={!epubReaderSettings.backgroundImage.layer.enabled}
                            value={epubReaderSettings.backgroundImage.layer.opacity}
                            labeled
                            labelText={t("settings.layerOpacity")}
                            timeout={[
                                350,
                                (value) =>
                                    dispatch(
                                        patchLiveBookReaderSettings({
                                            backgroundImage: {
                                                ...epubReaderSettings.backgroundImage,
                                                layer: {
                                                    ...epubReaderSettings.backgroundImage.layer,
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
