import React, { useState, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setAnilistToken } from "../../store/anilistToken";
import { setAniLoginOpen } from "../../store/isAniLoginOpen";

const AniLogin = () => {
    const [proceeded, setProceeded] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isAniLoginOpen = useAppSelector((store) => store.isAniLoginOpen);
    const contRef = useRef<HTMLDivElement>(null);

    const dispatch = useAppDispatch();
    useEffect(() => {
        if (isAniLoginOpen) {
            setTimeout(() => {
                contRef.current?.focus();
            }, 300);
        }
    }, [isAniLoginOpen]);

    return (
        <div id="anilistLogin">
            <div className="clickClose" onClick={() => dispatch(setAniLoginOpen(false))}></div>
            <div
                className="cont"
                onKeyDown={(e) => {
                    if (e.key === "Escape") dispatch(setAniLoginOpen(false));
                }}
                tabIndex={-1}
                ref={contRef}
            >
                <h1>Link AniList</h1>
                <p>
                    Click "Proceed" to start authorization process. After authorization, anilist will give you a
                    token, copy and paste that below to complete linking.
                </p>
                <div className="btns">
                    {!proceeded && (
                        <button
                            onClick={() => {
                                window.electron.shell.openExternal(
                                    "https://anilist.co/api/v2/oauth/authorize?client_id=13234&response_type=token"
                                );
                                setProceeded(true);
                            }}
                        >
                            Proceed
                        </button>
                    )}
                    {proceeded && (
                        <>
                            <input placeholder="Paste your token here" type="text" ref={inputRef} />
                            <button
                                className="submit"
                                onClick={(e) => {
                                    if (inputRef.current) {
                                        const token = inputRef.current.value.trimEnd();
                                        const elem = e.currentTarget;
                                        elem.innerText = "Checking...";
                                        window.al.checkToken(token).then((e) => {
                                            if (e) {
                                                elem.innerText = "Linked!";
                                                setTimeout(() => {
                                                    dispatch(setAnilistToken(token));
                                                    dispatch(setAniLoginOpen(false));
                                                }, 1000);
                                            } else {
                                                elem.innerText = "Invalid Token / Error";
                                                if (inputRef.current) inputRef.current.value = "";
                                                setTimeout(() => {
                                                    elem.innerText = "Submit";
                                                }, 2000);
                                            }
                                        });
                                    }
                                }}
                            >
                                Submit
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AniLogin;
