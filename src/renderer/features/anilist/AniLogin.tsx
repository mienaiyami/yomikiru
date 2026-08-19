import { setAnilistToken } from "@store/anilist";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { setAnilistLoginOpen } from "@store/ui";
import { checkAnilistToken } from "@utils/anilist";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import FocusLock from "react-focus-lock";
import { useTranslation } from "react-i18next";

const AniLogin: React.FC = () => {
    const { t } = useTranslation("anilist");
    const [proceeded, setProceeded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isAniLoginOpen = useAppSelector((store) => store.ui.isOpen.anilist.login);
    const contRef = useRef<HTMLDivElement>(null);

    const dispatch = useAppDispatch();
    useEffect(() => {
        if (isAniLoginOpen) {
            setTimeout(() => {
                contRef.current?.focus();
            }, 300);
        }
    }, [isAniLoginOpen]);

    useEffect(() => {
        setTimeout(() => {
            if (contRef.current) contRef.current.setAttribute("data-state", "open");
        }, 100);
    }, []);

    return (
        <FocusLock>
            <div
                id="anilistLogin"
                data-state="closed"
                ref={(node) => {
                    if (node) {
                        setTimeout(() => {
                            if (node) node.setAttribute("data-state", "open");
                        }, 100);
                    }
                }}
            >
                <div className="clickClose" onClick={() => dispatch(setAnilistLoginOpen(false))}></div>
                <div
                    className="overlayCont"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") dispatch(setAnilistLoginOpen(false));
                    }}
                    tabIndex={-1}
                    ref={contRef}
                >
                    <h1>{t("login.title")}</h1>
                    <p className="loginDesc">{t("login.desc")}</p>
                    <div className="btns">
                        {!proceeded && (
                            <button
                                onClick={() => {
                                    window.electron.openExternal(
                                        "https://anilist.co/api/v2/oauth/authorize?client_id=13234&response_type=token",
                                    );
                                    setProceeded(true);
                                }}
                            >
                                {t("login.proceed")}
                            </button>
                        )}
                        {proceeded && (
                            <>
                                <input
                                    placeholder={t("login.tokenPlaceholder")}
                                    type="text"
                                    ref={inputRef}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                    }}
                                />
                                <button
                                    className="submit"
                                    onClick={(e) => {
                                        if (inputRef.current) {
                                            const token = inputRef.current.value.trimEnd();
                                            const elem = e.currentTarget;
                                            elem.innerText = t("login.checking");
                                            checkAnilistToken(token).then((ok) => {
                                                if (ok) {
                                                    elem.innerText = t("login.linked");
                                                    setTimeout(() => {
                                                        dispatch(setAnilistToken(token));
                                                        dispatch(setAnilistLoginOpen(false));
                                                    }, 1000);
                                                } else {
                                                    elem.innerText = t("login.invalidToken");
                                                    if (inputRef.current) inputRef.current.value = "";
                                                    setTimeout(() => {
                                                        elem.innerText = t("login.submit");
                                                    }, 2000);
                                                }
                                            });
                                        }
                                    }}
                                >
                                    {t("login.submit")}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </FocusLock>
    );
};

export default AniLogin;
