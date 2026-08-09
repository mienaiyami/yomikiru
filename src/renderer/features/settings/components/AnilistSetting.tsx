import { setAnilistToken } from "@store/anilist";
import { setReaderSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAnilistLoginOpen } from "@store/ui";
import InputCheckbox from "@ui/InputCheckbox";
import AniList from "@utils/anilist";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsContext } from "../Settings";

const AnilistSetting: React.FC = () => {
    const { t } = useTranslation("settings");
    const { scrollIntoView } = useSettingsContext();
    const appSettings = useAppSelector((store) => store.appSettings);
    const [anilistUsername, setAnilistUsername] = useState("Error");
    const anilistToken = useAppSelector((store) => store.anilist.token);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (anilistToken)
            AniList.getUserName().then((name) => {
                if (name) setAnilistUsername(name);
            });
    }, [anilistToken]);
    return (
        <div className="settingItem2">
            <h3>{t("anilist.title")}</h3>
            <div className="desc">
                {t("anilist.desc")}{" "}
                <a
                    onClick={() => {
                        scrollIntoView("#settings-usage-anilist", "extras");
                    }}
                >
                    {t("shared.moreInfo")}
                </a>
                <br />
                {t("anilist.note")}
            </div>
            <div className="main row">
                <button
                    disabled={!!anilistToken}
                    onClick={() => {
                        dispatch(setAnilistLoginOpen(true));
                    }}
                >
                    {!anilistToken ? t("anilist.login") : t("anilist.loggedInAs", { username: anilistUsername })}
                </button>
                {anilistToken && (
                    <button
                        onClick={() => {
                            dispatch(setAnilistToken(""));
                        }}
                    >
                        {t("anilist.logout")}
                    </button>
                )}
            </div>
            <div className="toggleItem">
                <InputCheckbox
                    checked={appSettings.readerSettings.autoUpdateAnilistProgress}
                    className="noBG"
                    onChange={(e) => {
                        dispatch(
                            setReaderSettings({
                                autoUpdateAnilistProgress: e.currentTarget.checked,
                            }),
                        );
                    }}
                    disabled={!anilistToken}
                    labelAfter={t("anilist.autoUpdate")}
                />
                <div className="desc">{t("anilist.autoUpdateDesc")}</div>
            </div>
        </div>
    );
};

export default AnilistSetting;
