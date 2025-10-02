import { setReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setReaderLoading } from "@store/reader";
import InputNumber from "@ui/InputNumber";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { renderPDF } from "@utils/pdf";
import { useSettingsContext } from "../Settings";

const GeneralPDFSettings: React.FC = () => {
    const { scrollIntoView } = useSettingsContext();
    const appSettings = useAppSelector((store) => store.appSettings);
    const dispatch = useAppDispatch();
    return (
        <div className="settingItem2" id="settings-pdfScale">
            <h3>PDF OPTIONS</h3>
            <div className="desc">
                Scales PDF render quality. Higher scale results in higher quality.{" "}
                <a
                    onClick={() => {
                        scrollIntoView("#settings-usage-pdfScale", "extras");
                    }}
                >
                    More Info
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
                    labelBefore="SCALE"
                    className="noBG"
                />
            </div>
            <div className="desc">
                Render your pdf into png for faster loading. It is recommended to set{" "}
                <a
                    onClick={() => {
                        scrollIntoView("#settings-customTempFolder", "settings");
                    }}
                >
                    temp folder
                </a>{" "}
                to something that is not cleaned by your OS. <br />
                <a
                    onClick={() => {
                        scrollIntoView("#settings-keepExtractedFiles", "settings");
                    }}
                >
                    Keep Temp Files
                </a>{" "}
                must be enabled to use this.
            </div>
            <div className="main row">
                <button
                    disabled={!appSettings.keepExtractedFiles}
                    onClick={() => {
                        promptSelectDir(
                            (paths) => {
                                (async () => {
                                    if (!(paths instanceof Array && paths.length > 0)) return;
                                    // dispatch(setLoadingManga(true));
                                    // dispatch(setLoadingMangaPercent(0));
                                    for (let i = 0; i < paths.length; i++) {
                                        const path = paths[i];
                                        const linkSplitted = path.split(window.path.sep);
                                        dispatch(
                                            setReaderLoading({
                                                message: `[${i + 1}/${paths.length}] Rendering "${linkSplitted
                                                    .at(-1)
                                                    ?.substring(0, 20)}..."`,
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
                                        console.log(`Rendering "${path}" at "${renderPath}"`);
                                        try {
                                            await renderPDF(path, renderPath, appSettings.readerSettings.pdfScale);
                                        } catch (reason: any) {
                                            console.error(reason);
                                            if (reason && reason.message && !reason.message.includes("password"))
                                                dialogUtils.customError({
                                                    message: "Error in rendering PDF",
                                                    detail: path,
                                                    log: false,
                                                });
                                        }
                                    }
                                    dialogUtils.confirm({
                                        message: "Rendered all PDFs",
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
                    Select PDFs to render
                </button>
            </div>
        </div>
    );
};

export default GeneralPDFSettings;
