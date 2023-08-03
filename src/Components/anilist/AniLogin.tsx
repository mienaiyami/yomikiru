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

    useEffect(() => {
        setTimeout(() => {
            if (contRef.current) contRef.current.setAttribute("data-state", "open");
        }, 100);
    }, []);

    return (
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
            <div className="clickClose" onClick={() => dispatch(setAniLoginOpen(false))}></div>
            <div
                className="overlayCont"
                onKeyDown={(e) => {
                    if (e.key === "Escape") dispatch(setAniLoginOpen(false));
                }}
                tabIndex={-1}
                ref={contRef}
            >
                <h1>Link AniList</h1>
                <p>
                    Click "Proceed" to start authorization process. You will be redirected to your default browser.
                    After authorization, anilist will give you a token, copy and paste that below to complete
                    linking.
                    <br />
                    Check Usage & Features in settings for more info or ask on the github page.
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
                            <input
                                placeholder="Paste your token here"
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
