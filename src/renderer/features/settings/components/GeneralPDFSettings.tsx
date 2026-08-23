import { setReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setReaderLoading } from "@store/reader";
import InputNumber from "@ui/InputNumber";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { createRendererLogger } from "@utils/logger";
import { renderPDF } from "@utils/pdf";
import { useTranslation } from "react-i18next";
import { navigateToSetting } from "../utils/navigateToSetting";

const log = createRendererLogger("settings/GeneralPDFSettings");

const GeneralPDFSettings: React.FC = () => {
    const { t } = useTranslation("settings");
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    return (
        <div className="settingItem2" id="settings-pdfScale">
            <h3>{t("pdf.title")}</h3>
            <div className="desc">
                {t("pdf.scaleDesc")}{" "}
                <a
                    onClick={() => {
                        navigateToSetting("usage:pdf-scale", dispatch);
                    }}
                >
                    {t("shared.moreInfo")}
                </a>
            </div>
            <div className="main row">
                <InputNumber
                    value={appSettings.readerSettings.pdfScale}
                    min={0.1}
                    max={5}
                    step={0.1}
                    onChange={(e) => {
                        const value = e.valueAsNumber;
                        dispatch(setReaderSettings({ pdfScale: value }));
                    }}
                    labelBefore={t("pdf.scaleLabel")}
                    className="noBG"
                />
            </div>
            <div className="desc">
                {t("pdf.renderDescBefore")}
                <a
                    onClick={() => {
                        navigateToSetting("setting:custom-temp", dispatch);
                    }}
                >
                    {t("pdf.tempFolder")}
                </a>
                {t("pdf.renderDescMid")}
                <br />
                <a
                    onClick={() => {
                        navigateToSetting("setting:keep-extracted", dispatch);
                    }}
                >
                    {t("pdf.keepTempFiles")}
                </a>
                {t("pdf.renderDescAfter")}
            </div>
            <div className="main row">
                <button
                    disabled={!appSettings.keepExtractedFiles}
                    onClick={() => {
                        promptSelectDir(
                            (paths) => {
                                (async () => {
                                    if (!(Array.isArray(paths) && paths.length > 0)) return;
                                    // dispatch(setLoadingManga(true));
                                    // dispatch(setLoadingMangaPercent(0));
                                    for (let i = 0; i < paths.length; i++) {
                                        const path = paths[i];
                                        const linkSplitted = path.split(window.path.sep);
                                        dispatch(
                                            setReaderLoading({
                                                message: t("pdf.rendering", {
                                                    current: i + 1,
                                                    total: paths.length,
                                                    name: linkSplitted.at(-1)?.substring(0, 20),
                                                }),
                                            }),
                                        );
                                        const renderPath = window.path.join(
                                            window.electron.app.getPath("temp"),
                                            `yomikiru-temp-images-scale_${
                                                appSettings.readerSettings.pdfScale
                                            }-${linkSplitted.at(-1)}`,
                                        );
                                        if (window.fs.existsSync(renderPath))
                                            await window.fs.rm(renderPath, {
                                                recursive: true,
                                            });
                                        await window.fs.mkdir(renderPath);
                                        log.log(`rendering -> "${renderPath}"`);
                                        try {
                                            await renderPDF(path, renderPath, appSettings.readerSettings.pdfScale);
                                        } catch (reason: unknown) {
                                            log.error(`render failed for "${path}"`, reason);
                                            if (reason instanceof Error && !reason.message.includes("password"))
                                                dialogUtils.customError({
                                                    message: t("pdf.renderError"),
                                                    detail: path,
                                                    log: false,
                                                });
                                        }
                                    }
                                    dialogUtils.confirm({
                                        message: t("pdf.renderedAll"),
                                    });
                                    dispatch(setReaderLoading(null));
                                })();
                            },
                            true,
                            [
                                {
                                    extensions: ["pdf"],
                                    name: "pdf",
                                },
                            ],
                            true,
                        );
                    }}
                >
                    {t("pdf.selectPdfs")}
                </button>
            </div>
        </div>
    );
};

export default GeneralPDFSettings;
