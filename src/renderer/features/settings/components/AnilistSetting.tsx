import { useSettingsContext } from "../Settings";
import { setAnilistLoginOpen } from "@store/ui";
import { setAnilistToken } from "@store/anilist";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import AniList from "@utils/anilist";
import InputCheckbox from "@ui/InputCheckbox";
import { setReaderSettings } from "@store/appSettings";

const AnilistSetting: React.FC = () => {
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
            <h3>AniList</h3>
            <div className="desc">
                Link Yomikiru to your AniList account.{" "}
                <a
                    onClick={() => {
                        scrollIntoView("#settings-usage-anilist", "extras");
                    }}
                >
                    More Info
                </a>
                <br />
                NOTE: Yomikiru does not use internet for anything other than app updates if it is not linked with
                AniList.
            </div>
            <div className="main row">
                <button
                    disabled={anilistToken ? true : false}
                    onClick={() => {
                        dispatch(setAnilistLoginOpen(true));
                    }}
                >
                    {!anilistToken ? "Login with AniList" : `Logged in as ${anilistUsername}`}
                </button>
                {anilistToken && (
                    <button
                        onClick={() => {
                            dispatch(setAnilistToken(""));
                        }}
                    >
                        Logout
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
                    labelAfter="Auto-Update AniList Progress"
                />
                <div className="desc">
                    Automatically update AniList progress when chapter is read over 70%. Only works if chapter
                    names are well formatted.
                </div>
            </div>
        </div>
    );
};

export default AnilistSetting;
