import { AppContext } from "../App";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { faEdit, faLink, faPlus, faSync, faTimes, faTrash, faUnlink } from "@fortawesome/free-solid-svg-icons";
import themesRaw from "../themeInit.json";
import { newTheme, updateTheme, deleteTheme, setTheme, resetAllTheme, addThemes } from "../store/themes";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { resetShortcuts, setShortcuts } from "../store/shortcuts";
import { setOpenSetting } from "../store/isSettingOpen";
import { addBookmark, removeAllBookmarks } from "../store/bookmarks";
import { makeNewSettings, setAppSettings, setEpubReaderSettings, setReaderSettings } from "../store/appSettings";
import { InputSelect } from "./Element/InputSelect";
import InputRange from "./Element/InputRange";
import { promptSelectDir } from "../MainImports";
import { deleteAllHistory } from "../store/history";
import InputNumber from "./Element/InputNumber";
import InputColor from "./Element/InputColor";
import { setAnilistToken } from "../store/anilistToken";
import { setAniLoginOpen } from "../store/isAniLoginOpen";

const Settings = (): ReactElement => {
    const appSettings = useAppSelector((store) => store.appSettings);
    const theme = useAppSelector((store) => store.theme.name);
    const allThemes = useAppSelector((store) => store.theme.allData);
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const isSettingOpen = useAppSelector((store) => store.isSettingOpen);
    const anilistToken = useAppSelector((store) => store.anilistToken);

    const [anilistUsername, setAnilistUsername] = useState("Error");

    //  hardware acceleration
    const [HAValue, setHAValue] = useState(
        window.fs.existsSync(
            window.path.join(window.electron.app.getPath("userData"), "DISABLE_HARDWARE_ACCELERATION")
        ) || false
    );

    const dispatch = useAppDispatch();

    const settingContRef = useRef<HTMLDivElement>(null);

    const currentTheme = useMemo(() => {
        return allThemes.find((e) => e.name === theme)!.main;
    }, [theme]);
    const themeMakerRef = useRef<HTMLDivElement>(null);
    const themeNameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isSettingOpen) {
            setTimeout(() => {
                settingContRef.current?.focus();
            }, 300);
        }
    }, [isSettingOpen]);

    useEffect(() => {
        if (anilistToken)
            window.al.getUserName().then((name) => {
                if (name) setAnilistUsername(name);
            });
    }, [anilistToken]);

    const reservedKeys = ["h", "Control", "Tab", "Shift", "Alt", "Escape"];
    const applyThemeTemp = () => {
        const props: ThemeDataMain[] = [...themeMakerRef.current!.getElementsByClassName("newThemeMakerProp")].map(
            (e) => (e as HTMLElement).getAttribute("data-prop") as ThemeDataMain
        );
        let vars = "";
        [...themeMakerRef.current!.getElementsByClassName("newThemeMakerRow")].forEach((e, i) => {
            if (e.getElementsByTagName("label")[0].classList.contains("selected")) {
                vars += `${props[i]}:${
                    (e.getElementsByClassName("newThemeMakerVar")[0] as HTMLInputElement).value
                };`;
            } else {
                vars += `${props[i]}:${
                    (e.getElementsByClassName("newThemeMakerColorFull")[0] as HTMLInputElement).value
                };`;
            }
        });
        document.body.setAttribute("style", vars);
        if (process.platform === "win32")
            window.electron.getCurrentWindow().setTitleBarOverlay({
                color: window.getComputedStyle(document.querySelector("body #topBar")!).backgroundColor,
                symbolColor: window.getComputedStyle(document.querySelector("body #topBar .homeBtns button")!)
                    .color,
                height: Math.floor(40 * window.electron.webFrame.getZoomFactor()),
            });
    };
    const saveTheme = (saveAndReplace = false) => {
        let name = "";
        if (themeNameInputRef.current!.value === "") name = window.app.randomString(6);
        if (saveAndReplace) name = theme;
        else name = themeNameInputRef.current!.value;
        if (themesRaw.allData.map((e) => e.name).includes(name)) {
            window.dialog.customError({
                title: "Error",
                message: `Unable to edit default themes, save as new instead.`,
            });
            return;
        }
        if (!saveAndReplace && allThemes.map((e) => e.name).includes(themeNameInputRef.current!.value)) {
            window.dialog.customError({
                title: "Error",
                message: `Theme name "${themeNameInputRef.current!.value}" already exist, choose something else.`,
            });
            return;
        }
        const props: ThemeDataMain[] = [...themeMakerRef.current!.getElementsByClassName("newThemeMakerProp")].map(
            (e) => (e as HTMLElement).getAttribute("data-prop") as ThemeDataMain
        );
        themeNameInputRef.current!.value = window.app.randomString(6);
        const newThemeData = { ...window.themeProps };
        [...themeMakerRef.current!.getElementsByClassName("newThemeMakerRow")].forEach((e, i) => {
            if (e.getElementsByTagName("label")[0].classList.contains("selected")) {
                newThemeData[props[i]] = (
                    e.getElementsByClassName("newThemeMakerVar")[0] as HTMLInputElement
                ).value;
            } else {
                newThemeData[props[i]] = (
                    e.getElementsByClassName("newThemeMakerColorFull")[0] as HTMLInputElement
                ).value;
            }
        });
        if (saveAndReplace) {
            dispatch(updateTheme({ themeName: name, newThemeData }));
            // setAllThemes((init) => {
            //     init[init.findIndex((e) => e.name === name)].main = newThemeData;
            //     return [...init];
            // });
            return;
        }
        dispatch(newTheme({ name: name, main: newThemeData }));
        // setAllThemes((init) => {
        //     init.push({ name: name, main: newThemeData });
        //     return [...init];
        // });
        dispatch(setTheme(name));
    };

    const ShortcutInput = ({ which, i }: { which: "key1" | "key2"; i: number }) => (
        <input
            type="text"
            value={shortcuts[i][which] === " " ? "Space" : shortcuts[i][which]}
            onKeyDown={(e) => {
                e.stopPropagation();
            }}
            onKeyUp={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (reservedKeys.includes(e.key)) {
                    window.logger.warn(`"${e.key}"` + " is reserved key.");
                    e.currentTarget.focus();
                    return;
                }
                settingContRef.current?.focus();
                if (e.key === "Backspace") {
                    window.logger.log(`Deleting shortcut ${shortcuts[i].command}.${which}`);
                    dispatch(setShortcuts({ index: i, key: "", which }));
                    return;
                }
                const dupIndex = shortcuts.findIndex((elem) => elem.key1 === e.key || elem.key2 === e.key);
                if (dupIndex >= 0) {
                    window.logger.warn(`"${e.key}" key already bind to "${shortcuts[dupIndex].name}"`);
                    window.dialog.warn({
                        message: `"${e.key}" key already bind to "${shortcuts[dupIndex].name}".`,
                    });
                    return;
                }
                window.logger.log(`Setting shortcut ${shortcuts[i].command}.${which} to "${e.key}"`);
                dispatch(setShortcuts({ index: i, key: e.key, which }));
            }}
            readOnly
            spellCheck={false}
        />
    );
    const ThemeElement = ({ color, prop }: { color: string; prop: ThemeDataMain }): ReactElement => {
        const ref = useRef<HTMLInputElement>(null);
        const [firstRendered, setFirstRendered] = useState(false);
        // ex. #ffffff
        const [rawColor, setRawColor] = useState(color.substring(0, 7));
        // ex. #ffffffff , var(--icon-color)
        const [rawColorWhole, setRawColorWhole] = useState(color);
        const [opacity, setOpacity] = useState(color.length > 7 ? parseInt(color.substring(7), 16) / 2.55 : 100);
        const [checked, setChecked] = useState(color.substring(0, 4) === "var(" ? true : false);

        useEffect(() => {
            setFirstRendered(true);
        }, []);
        useLayoutEffect(() => {
            let base = color;
            while (base && currentTheme[base.replace("var(", "").replace(")", "") as ThemeDataMain]) {
                const clr = currentTheme[base.replace("var(", "").replace(")", "") as ThemeDataMain];
                if (clr.includes("var(")) {
                    base = clr;
                    continue;
                }
                setRawColor(clr.substring(0, 7));
                setOpacity(clr.length > 7 ? parseInt(clr.substring(7), 16) / 2.55 : 100);
                break;
            }
        }, []);
        useLayoutEffect(() => {
            if (firstRendered) {
                // console.log(
                //     prop,
                //     rawColor.substring(0, 7) +
                //         (Math.ceil(opacity * 2.55).toString(16).length < 2
                //             ? "0" + Math.ceil(opacity * 2.55).toString(16)
                //             : Math.ceil(opacity * 2.55).toString(16))
                // );
                // if (process.platform === "win32") {
                //     if (prop === "--icon-color")
                //         window.electron.getCurrentWindow().setTitleBarOverlay({ symbolColor: rawColor });
                //     if (prop === "--topBar-color")
                //         window.electron.getCurrentWindow().setTitleBarOverlay({ color: rawColor });
                // }
                applyThemeTemp();
                // document.body.style.setProperty(
                //     prop,
                //     rawColor.substring(0, 7) +
                //         (Math.ceil(opacity * 2.55).toString(16).length < 2
                //             ? "0" + Math.ceil(opacity * 2.55).toString(16)
                //             : Math.ceil(opacity * 2.55).toString(16))
                // );
            }
        }, [rawColor, opacity, rawColorWhole]);
        // useLayoutEffect(() => {
        //     if (firstRendered) {
        //         // if (process.platform === "win32") {
        //         //     //! fix - change theme without saving
        //         //     if (prop === "--icon-color")
        //         //         window.electron.getCurrentWindow().setTitleBarOverlay({ symbolColor: rawColor });
        //         //     if (prop === "--topBar-color")
        //         //         window.electron.getCurrentWindow().setTitleBarOverlay({ color: rawColor });
        //         // }
        //         // document.body.style.setProperty(prop, rawColorWhole);
        //         applyThemeTemp();
        //     }
        // }, [rawColorWhole]);
        return (
            <>
                <td>
                    <button
                        className="resetBtn"
                        onClick={() => {
                            setChecked(color.substring(0, 4) === "var(" ? true : false);
                            setRawColorWhole(color);
                            setRawColor(color.substring(0, 7));
                            setOpacity(color.length > 7 ? parseInt(color.substring(7), 16) / 2.55 : 100);
                        }}
                        title="Reset"
                    >
                        <FontAwesomeIcon icon={faSync} />
                    </button>
                    <label className={checked ? "selected" : ""} title="Link to variable">
                        <input
                            type="checkbox"
                            defaultChecked={checked}
                            ref={ref}
                            onChange={() => setChecked((init) => !init)}
                        />
                        <FontAwesomeIcon icon={checked ? faUnlink : faLink} />
                    </label>
                </td>
                <td>
                    {checked ? (
                        <InputSelect
                            value={rawColorWhole}
                            className="newThemeMakerVar"
                            onChange={(e) => {
                                setRawColorWhole(e.currentTarget.value);
                            }}
                        >
                            {Object.entries(window.themeProps).map((e) => (
                                <option key={e[0]} value={`var(${e[0]})`}>
                                    {e[1]}
                                </option>
                            ))}
                        </InputSelect>
                    ) : (
                        <>
                            <InputColor
                                value={rawColor || "#000000"}
                                timeout={[
                                    500,
                                    (value) => setRawColor(value === "" ? "#000000" : value.substring(0, 7)),
                                ]}
                                title="Color"
                            />
                            {/* <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.ceil(opacity) ?? 100}
                                title="Opacity"
                                // className="newThemeMakerOpacity"
                                onChange={(e) => {
                                    setOpacity(() => {
                                        if (e.target.value === "") {
                                            e.target.value = "0";
                                        }
                                        let value = e.target.valueAsNumber ?? 100;
                                        if (value > 100) value = 100;
                                        return value;
                                    });
                                }}
                            /> */}
                            <InputRange
                                min={0}
                                max={100}
                                value={Math.ceil(opacity) ?? 100}
                                title="Opacity"
                                className="opacityRange"
                                labeled
                                timeout={[200, (value) => setOpacity(value)]}
                            />
                            <input
                                type="text"
                                className="newThemeMakerColorFull"
                                onKeyDown={(e) => {
                                    e.stopPropagation();
                                }}
                                value={
                                    rawColor.substring(0, 7) +
                                    (Math.ceil(opacity * 2.55).toString(16).length < 2
                                        ? "0" + Math.ceil(opacity * 2.55).toString(16)
                                        : Math.ceil(opacity * 2.55).toString(16))
                                }
                                style={{ display: "none" }}
                                readOnly
                            />
                        </>
                    )}
                </td>
            </>
        );
    };

    return (
        <div id="settings" data-state={isSettingOpen ? "open" : "closed"}>
            <div className="clickClose" onClick={() => dispatch(setOpenSetting(false))}></div>
            <div
                className={"cont"}
                onKeyDown={(e) => {
                    if (e.key === "Escape") dispatch(setOpenSetting(false));
                }}
                tabIndex={-1}
                ref={settingContRef}
                // onScroll={(e) => {
                //     e.currentTarget.querySelectorAll(":scope > h1").forEach((h1) => {
                //         // console.log(
                //         //     h1.getBoundingClientRect().bottom,
                //         //     h1.nextElementSibling?.getBoundingClientRect().bottom
                //         // );
                //         if (h1.nextElementSibling)
                //             if (
                //                 h1.getBoundingClientRect().bottom >
                //                 h1.nextElementSibling?.getBoundingClientRect().bottom
                //             )
                //                 h1.classList.add("smol");
                //             else h1.classList.remove("smol");
                //     });
                // }}
            >
                <h1>
                    Settings
                    {/* <button onClick={() => dispatch(setOpenSetting(false))} className="closeBtn">
                                <FontAwesomeIcon icon={faTimes} />
                            </button> */}
                </h1>
                <div className="content">
                    <table>
                        <tbody>
                            <tr className="settingItem">
                                <td className="name">Default Location</td>
                                <td className="current">
                                    <input type="text" value={appSettings.baseDir} readOnly />
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            promptSelectDir((path) => dispatch(setAppSettings({ baseDir: path })));
                                        }}
                                    >
                                        Change Default
                                    </button>
                                </td>
                            </tr>
                            <tr className="settingItem">
                                <td className="name">Custom Stylesheet</td>
                                <td className="current">
                                    <input
                                        type="text"
                                        placeholder="NOTE: Do not move .css file in app's folder"
                                        value={appSettings.customStylesheet}
                                        readOnly
                                    />
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={(e) => {
                                            promptSelectDir(
                                                (path) => {
                                                    dispatch(setAppSettings({ customStylesheet: path }));
                                                    const target = e.currentTarget;
                                                    target.innerText = "Refresh to apply";
                                                    setTimeout(() => {
                                                        target.innerText = "Select";
                                                    }, 4000);
                                                },
                                                true,
                                                [
                                                    {
                                                        extensions: ["css"],
                                                        name: "Cascading Style Sheets",
                                                    },
                                                ]
                                            );
                                        }}
                                    >
                                        Select
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            dispatch(setAppSettings({ customStylesheet: "" }));
                                            const target = e.currentTarget;
                                            target.innerText = "Refresh to apply";
                                            setTimeout(() => {
                                                target.innerText = "Clear";
                                            }, 4000);
                                        }}
                                    >
                                        Clear
                                    </button>
                                </td>
                            </tr>
                            <tr className="settingItem exportBookmark">
                                <td className="name">Bookmarks</td>
                                <td className="current">
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            if (bookmarks.length === 0) {
                                                window.dialog.customError({
                                                    message: "No bookmarks detected.",
                                                    log: false,
                                                });
                                                return;
                                            }
                                            const opt = window.electron.dialog.showSaveDialogSync(
                                                window.electron.getCurrentWindow(),
                                                {
                                                    title: "Export Bookmarks",
                                                    defaultPath: "yomikiru-bookmarks.json",
                                                    filters: [
                                                        {
                                                            name: "json",
                                                            extensions: ["json"],
                                                        },
                                                    ],
                                                }
                                            );
                                            if (opt == undefined) return;
                                            window.fs.writeFileSync(
                                                opt,
                                                JSON.stringify(bookmarks, null, "\t") || JSON.stringify([])
                                            );
                                        }}
                                    >
                                        Export
                                    </button>
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            const opt = window.electron.dialog.showOpenDialogSync(
                                                window.electron.getCurrentWindow(),
                                                {
                                                    properties: ["openFile"],
                                                    filters: [
                                                        {
                                                            name: "Json",
                                                            extensions: ["json"],
                                                        },
                                                    ],
                                                }
                                            );
                                            if (opt == undefined) return;
                                            const data: Manga_BookItem[] = JSON.parse(
                                                window.fs.readFileSync(opt[0], "utf8")
                                            );
                                            const dataToAdd: Manga_BookItem[] = [];
                                            let similarFound = 0;
                                            let importedCount = 0;
                                            if (!(data instanceof Array)) {
                                                window.dialog.customError({
                                                    message:
                                                        "Data is not in correct format. To make sure it is correct, compare it with existing bookmark.json and fix.",
                                                    log: false,
                                                });
                                                return;
                                            }
                                            data.forEach((item) => {
                                                if ("type" in item && "data" in item) {
                                                    if (
                                                        !bookmarks.map((e) => e.data.link).includes(item.data.link)
                                                    ) {
                                                        dataToAdd.push(item);
                                                        importedCount++;
                                                    } else {
                                                        similarFound++;
                                                    }
                                                }
                                            });
                                            if (similarFound > 0)
                                                window.dialog.warn({
                                                    title: "warning",
                                                    message: "Found " + similarFound + " with same link",
                                                });
                                            window.dialog.confirm({
                                                title: "Imported",
                                                message: "Imported " + importedCount + " bookmarks.",
                                                noOption: true,
                                            });
                                            dispatch(addBookmark(dataToAdd));
                                        }}
                                    >
                                        Import
                                    </button>
                                    <button
                                        // onFocus={(e) => e.currentTarget.blur()}
                                        onClick={() => {
                                            window.dialog
                                                .warn({
                                                    title: "Delete BookMarks",
                                                    message: "Are you sure you want to clear bookmarks?",
                                                    noOption: false,
                                                })
                                                .then(({ response }) => {
                                                    if (response == undefined) return;
                                                    if (response === 1) return;
                                                    if (response === 0) {
                                                        window.dialog
                                                            .warn({
                                                                title: "Delete Bookmarks",
                                                                noOption: false,
                                                                message:
                                                                    "Are you really sure you want to clear bookmarks?\nThis process is irreversible.",
                                                            })
                                                            .then((res) => {
                                                                if (res.response === 1) return;
                                                                dispatch(removeAllBookmarks());
                                                            });
                                                    }
                                                });
                                        }}
                                    >
                                        Delete All Bookmarks
                                    </button>
                                </td>
                            </tr>
                            <tr className="settingItem themeSelector">
                                <td className="name">Theme</td>
                                <td className="current">
                                    {/* <p>
                                                Add custom theme by adding new item with changed css variable in <br />
                                                <span className="copy">
                                                    {window.path.join(window.electron.app.getPath("userData"), "themes.json")}
                                                </span>
                                            </p> */}
                                    {allThemes.map((e, i) => (
                                        <div className="themeButtons" key={e.name}>
                                            <button
                                                className={theme === e.name ? "selected" : ""}
                                                onClick={() => dispatch(setTheme(e.name))}
                                            >
                                                {e.name}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (e.name === theme) {
                                                        window.dialog.warn({
                                                            message:
                                                                "Choose other theme before deleting this one.",
                                                        });
                                                        return;
                                                    }
                                                    if (themesRaw.allData.map((q) => q.name).includes(e.name)) {
                                                        window.dialog.customError({
                                                            title: "Error",
                                                            message: `Unable to delete default themes.`,
                                                        });
                                                        return;
                                                    }
                                                    window.dialog
                                                        .confirm({
                                                            message: `Delete theme "${e.name}"`,
                                                            noOption: false,
                                                        })
                                                        .then((res) => {
                                                            if (res.response === 0) {
                                                                dispatch(deleteTheme(i));
                                                                // setAllThemes((init) => {
                                                                //     init.splice(i, 1);
                                                                //     return [...init];
                                                                // });
                                                            }
                                                        });
                                                }}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            themeMakerRef.current?.focus();
                                            themeMakerRef.current?.scrollIntoView({
                                                behavior: "smooth",
                                                block: "start",
                                            });
                                        }}
                                    >
                                        <FontAwesomeIcon icon={faPlus} /> <span className="icon">/</span>{" "}
                                        <FontAwesomeIcon icon={faEdit} />
                                    </button>
                                    <hr />
                                    <button
                                        onClick={() => {
                                            const opt = window.electron.dialog.showSaveDialogSync(
                                                window.electron.getCurrentWindow(),
                                                {
                                                    title: "Export Themes",
                                                    defaultPath: "yomikiru-themes.json",
                                                    filters: [
                                                        {
                                                            name: "json",
                                                            extensions: ["json"],
                                                        },
                                                    ],
                                                }
                                            );
                                            if (opt == undefined) return;
                                            const themeForExport = allThemes.filter(
                                                (e) => !themesRaw.allData.map((e) => e.name).includes(e.name)
                                            );
                                            window.fs.writeFileSync(
                                                opt,
                                                JSON.stringify(themeForExport, null, "\t")
                                            );
                                        }}
                                    >
                                        Export
                                    </button>
                                    <button
                                        onClick={() => {
                                            const opt = window.electron.dialog.showOpenDialogSync(
                                                window.electron.getCurrentWindow(),
                                                {
                                                    properties: ["openFile"],
                                                    filters: [
                                                        {
                                                            name: "Json",
                                                            extensions: ["json"],
                                                        },
                                                    ],
                                                }
                                            );
                                            if (opt == undefined) return;
                                            const data: ThemeData[] | Themes = JSON.parse(
                                                window.fs.readFileSync(opt[0], "utf8")
                                            );
                                            const dataToAdd: ThemeData[] = [];
                                            let importedCount = 0;
                                            const existingThemeNames = allThemes.map((e) => e.name);
                                            if (!(data instanceof Array)) {
                                                if ("name" in data && "allData" in data) {
                                                    data.allData.forEach((e, i) => {
                                                        if ("name" in e && "main" in e) {
                                                            if (
                                                                existingThemeNames.includes(e.name) ||
                                                                dataToAdd.map((a) => a.name).includes(e.name)
                                                            ) {
                                                                window.dialog.warn({
                                                                    message:
                                                                        "Same theme name detected. Wont be imported.\nName: " +
                                                                        e.name,
                                                                });
                                                            } else {
                                                                dataToAdd.push(e);
                                                                importedCount++;
                                                            }
                                                        } else
                                                            window.logger.warn(
                                                                "IMPORTING THEMES: Invalid data at index",
                                                                i
                                                            );
                                                    });
                                                } else {
                                                    window.dialog.customError({
                                                        message: "Data is not in correct format.",
                                                        log: false,
                                                    });
                                                    return;
                                                }
                                            } else
                                                data.forEach((e, i) => {
                                                    if ("name" in e && "main" in e) {
                                                        if (
                                                            existingThemeNames.includes(e.name) ||
                                                            dataToAdd.map((a) => a.name).includes(e.name)
                                                        ) {
                                                            window.dialog.warn({
                                                                message:
                                                                    "Same theme name detected. Wont be imported.\nName: " +
                                                                    e.name,
                                                            });
                                                        } else {
                                                            dataToAdd.push(e);
                                                            importedCount++;
                                                        }
                                                    } else
                                                        window.logger.warn(
                                                            "IMPORTING THEMES: Invalid data at index",
                                                            i
                                                        );
                                                });
                                            window.dialog.confirm({
                                                title: "Imported",
                                                message: "Imported " + importedCount + " themes.",
                                                noOption: true,
                                            });
                                            dispatch(addThemes(dataToAdd));
                                        }}
                                    >
                                        Import
                                    </button>
                                    <button
                                        onClick={() => {
                                            const theme = window.electron.clipboard.readText("clipboard");
                                            if (theme) {
                                                try {
                                                    const themeJSON = JSON.parse(theme);
                                                    if (themeJSON) {
                                                        if ("name" in themeJSON && "main" in themeJSON) {
                                                            if (
                                                                allThemes
                                                                    .map((e) => e.name)
                                                                    .includes(themeJSON.name)
                                                            ) {
                                                                window.dialog.warn({
                                                                    message:
                                                                        "Same theme name detected. Wont be imported.\nName: " +
                                                                        themeJSON.name,
                                                                });
                                                            } else {
                                                                dispatch(newTheme(themeJSON));
                                                            }
                                                        } else
                                                            window.dialog.customError({
                                                                title: "Failed",
                                                                message: `Invalid theme data. Please note that data must be similar to the result of "Copy Current Theme to Clipboard"`,
                                                            });
                                                    }
                                                } catch (reason) {
                                                    window.dialog.customError({
                                                        title: "Failed",
                                                        message: `Invalid theme data. Please note that data much be similar to the result of "Copy Current Theme to Clipboard"`,
                                                    });
                                                }
                                            }
                                        }}
                                    >
                                        Save Theme from Clipboard
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            const currentTheme = allThemes.find((e) => e.name === theme);
                                            if (currentTheme) {
                                                try {
                                                    window.electron.clipboard.writeText(
                                                        JSON.stringify(currentTheme, null, "\t")
                                                    );
                                                    const target = e.currentTarget;
                                                    const oldText = target.innerText;
                                                    target.innerText =
                                                        "\u00a0".repeat(23) + "Copied!" + "\u00a0".repeat(23);
                                                    setTimeout(() => {
                                                        target.innerText = oldText;
                                                    }, 3000);
                                                } catch (reason) {
                                                    window.dialog.customError({
                                                        message: "Failed to copy theme: " + reason,
                                                    });
                                                }
                                            }
                                        }}
                                    >
                                        Copy Current Theme to Clipboard
                                    </button>
                                    <button
                                        onClick={() =>
                                            window.electron.shell.openExternal(
                                                "https://github.com/mienaiyami/yomikiru/discussions/191"
                                            )
                                        }
                                    >
                                        Get more Themes
                                    </button>
                                </td>
                            </tr>
                            {process.platform === "win32" && (
                                <tr className="settingItem">
                                    <td className="name">File Explorer Option </td>
                                    <td className="current">
                                        <button
                                            onClick={() =>
                                                window.electron.ipcRenderer.send("addOptionToExplorerMenu")
                                            }
                                        >
                                            Add
                                        </button>
                                        <button
                                            onClick={() =>
                                                window.electron.ipcRenderer.send("deleteOptionInExplorerMenu")
                                            }
                                        >
                                            Remove
                                        </button>
                                        <button
                                            onClick={() =>
                                                window.electron.ipcRenderer.send("addOptionToExplorerMenu:epub")
                                            }
                                        >
                                            Add (EPub)
                                        </button>
                                        <button
                                            onClick={() =>
                                                window.electron.ipcRenderer.send("deleteOptionInExplorerMenu:epub")
                                            }
                                        >
                                            Remove (EPub)
                                        </button>
                                    </td>
                                </tr>
                            )}
                            <tr className="settingItem">
                                <td className="name">Check for Update</td>
                                <td className="current">
                                    <label className={appSettings.updateCheckerEnabled ? "selected" : ""}>
                                        <input
                                            type="checkbox"
                                            checked={appSettings.updateCheckerEnabled}
                                            onChange={(e) => {
                                                dispatch(
                                                    setAppSettings({
                                                        updateCheckerEnabled: e.currentTarget.checked,
                                                    })
                                                );
                                            }}
                                        />
                                        <p>Check on App Startup</p>
                                    </label>
                                    <button
                                        onClick={() => {
                                            window.electron.ipcRenderer.send(
                                                "checkForUpdate",
                                                window.electron.getCurrentWindow().id,
                                                true
                                            );
                                        }}
                                    >
                                        Check for Update Now
                                    </button>
                                </td>
                            </tr>
                            <tr className="settingItem">
                                <td className="name">AniList</td>
                                <td className="current">
                                    <button
                                        disabled={anilistToken ? true : false}
                                        onClick={() => {
                                            dispatch(setAniLoginOpen(true));
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
                                </td>
                            </tr>

                            {/* <tr className="settingItem">
                                    <td className="name">Other Settings</td>
                                </tr> */}
                            {/* <div className="settingItem version">
                                        <div className="name">Others:</div>
                                        <div className="current">
                                            <label>
                                                <input type="checkbox" />
                                                <p>Show Loading Screen</p>
                                            </label>
                                        </div>
                                    </div> */}
                        </tbody>
                    </table>
                    <div className="otherSettings">
                        <div className="current fullWidth list">
                            <label className={appSettings.skipMinorUpdate ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.skipMinorUpdate}
                                    onChange={(e) => {
                                        dispatch(setAppSettings({ skipMinorUpdate: e.currentTarget.checked }));
                                    }}
                                />
                                <p>Skip minor updates.</p>
                            </label>
                            <label className={appSettings.openOnDblClick ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.openOnDblClick}
                                    onChange={(e) => {
                                        dispatch(setAppSettings({ openOnDblClick: e.currentTarget.checked }));
                                    }}
                                />
                                <p>Open in Reader on double-click.</p>
                            </label>
                            <label className={appSettings.askBeforeClosing ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.askBeforeClosing}
                                    onChange={(e) => {
                                        dispatch(setAppSettings({ askBeforeClosing: e.currentTarget.checked }));
                                    }}
                                />
                                <p>
                                    Ask before closing window? <code>Needs App Restart</code>.
                                </p>
                            </label>
                            <label className={appSettings.recordChapterRead ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.recordChapterRead}
                                    onChange={(e) => {
                                        dispatch(setAppSettings({ recordChapterRead: e.currentTarget.checked }));
                                    }}
                                />
                                <p>
                                    Record chapter read. If chapter is already read, it will appear with different
                                    color in reader-side-list and home.
                                </p>
                            </label>
                            <label className={appSettings.openDirectlyFromManga ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.openDirectlyFromManga}
                                    onChange={(e) => {
                                        dispatch(
                                            setAppSettings({ openDirectlyFromManga: e.currentTarget.checked })
                                        );
                                    }}
                                />
                                <p>
                                    Open chapter directly by clicking name instead of arrow in reader if chapter
                                    folder is in manga folder inside <code>default location</code> (See Usage and
                                    Feature for more info).
                                </p>
                            </label>
                            <label
                                className={
                                    appSettings.readerSettings.disableChapterTransitionScreen ? "selected" : ""
                                }
                            >
                                <input
                                    type="checkbox"
                                    checked={appSettings.readerSettings.disableChapterTransitionScreen}
                                    onChange={(e) => {
                                        dispatch(
                                            setReaderSettings({
                                                disableChapterTransitionScreen: e.currentTarget.checked,
                                            })
                                        );
                                    }}
                                />
                                <p>
                                    Disable the chapter transition (start/end) screen (only in
                                    <code>vertical scroll</code> Reading mode).
                                </p>
                            </label>
                            {/* <label className={appSettings.showPageNumOnHome ? "selected" : ""}>
                                    <input
                                        type="checkbox"
                                        checked={appSettings.showPageNumOnHome}
                                        onChange={(e) => {
                                            dispatch(setAppSettings({ showPageNumOnHome: e.currentTarget.checked }));
                                        }}
                                    />
                                    <p>Show page number on in bookmark/history tab on home page.</p>
                                </label> */}
                            <label className={appSettings.disableListNumbering ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.disableListNumbering}
                                    onChange={(e) => {
                                        dispatch(
                                            setAppSettings({ disableListNumbering: e.currentTarget.checked })
                                        );
                                    }}
                                />
                                <p>Disable location list numbering.</p>
                            </label>
                            <label className={appSettings.showSearch ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.showSearch}
                                    onChange={(e) => {
                                        dispatch(setAppSettings({ showSearch: e.currentTarget.checked }));
                                    }}
                                />
                                <p>Show search input for bookmark/history tab.</p>
                            </label>
                            <label className={appSettings.openInZenMode ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.openInZenMode}
                                    onChange={(e) => {
                                        dispatch(setAppSettings({ openInZenMode: e.currentTarget.checked }));
                                    }}
                                />
                                <p>
                                    Open in <code>Zen Mode</code> by default.
                                </p>
                            </label>
                            <label className={appSettings.hideCursorInZenMode ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.hideCursorInZenMode}
                                    onChange={(e) => {
                                        dispatch(setAppSettings({ hideCursorInZenMode: e.currentTarget.checked }));
                                    }}
                                />
                                <p>
                                    Hide cursor in <code>Zen Mode</code>.
                                </p>
                            </label>
                            <label className={appSettings.useCanvasBasedReader ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.useCanvasBasedReader}
                                    onChange={(e) => {
                                        dispatch(
                                            setAppSettings({ useCanvasBasedReader: e.currentTarget.checked })
                                        );
                                    }}
                                />
                                <p>
                                    Make scrolling smooth and prevent stuttering when reading high res images.
                                    <br />
                                    Drawbacks : high RAM usage and less crispy images when size is set to a low
                                    value.
                                    <code>BETA</code>
                                </p>
                            </label>
                            <label className={appSettings.epubReaderSettings.loadOneChapter ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={appSettings.epubReaderSettings.loadOneChapter}
                                    onChange={(e) => {
                                        dispatch(
                                            setEpubReaderSettings({ loadOneChapter: e.currentTarget.checked })
                                        );
                                    }}
                                />
                                <p>
                                    Load and show one chapter at a time (from TOC).
                                    <br />
                                    Drawback : Content outside of TOC will not be accessible
                                </p>
                            </label>
                            <label className={HAValue ? "selected" : ""}>
                                <input
                                    type="checkbox"
                                    checked={HAValue}
                                    onChange={(e) => {
                                        const fileName = window.path.join(
                                            window.electron.app.getPath("userData"),
                                            "DISABLE_HARDWARE_ACCELERATION"
                                        );
                                        if (e.currentTarget.checked) {
                                            window.fs.writeFileSync(fileName, " ");
                                        } else {
                                            if (window.fs.existsSync(fileName)) window.fs.rmSync(fileName);
                                        }
                                        setHAValue((init) => !init);
                                    }}
                                />
                                <p>
                                    Disable Hardware Acceleration. <code>Need App Restart</code>
                                </p>
                            </label>
                            <InputNumber
                                value={appSettings.readerSettings.pdfScale}
                                min={0.1}
                                max={5}
                                step={0.1}
                                onChange={(e) => {
                                    let value = e.target.valueAsNumber;
                                    if (!value) value = 0;
                                    value = value >= 5 ? 5 : value;
                                    value = value <= 0.1 ? 0.1 : value;
                                    dispatch(setReaderSettings({ pdfScale: value }));
                                }}
                                labeled
                                title="Check Usage & Feature for more info"
                                paraBefore="PDF Scale (&nbsp;&#8593;&nbsp;value = &nbsp;&#8593;&nbsp;quality ):"
                            />
                            <hr style={{ margin: "20px 0" }} />
                            <div className="row" style={{ gap: "10px" }}>
                                <button
                                    onClick={() => {
                                        window.dialog
                                            .warn({
                                                title: "Warning",
                                                message: "Are you sure you want to clear history?",
                                                noOption: false,
                                            })
                                            .then((res) => {
                                                if (res && res.response === 0) dispatch(deleteAllHistory());
                                            });
                                    }}
                                >
                                    Clear History
                                </button>
                                <button
                                    onClick={() => {
                                        window.dialog
                                            .warn({
                                                title: "Reset themes",
                                                message: "This will delete all Themes. Continue?",
                                                noOption: false,
                                            })
                                            .then(({ response }) => {
                                                if (response == undefined) return;
                                                if (response === 1) return;
                                                if (response === 0) {
                                                    window.dialog
                                                        .warn({
                                                            title: "Reset Settings",
                                                            noOption: false,
                                                            message:
                                                                "Are you really sure you want to delete all Themes?\nThis process is irreversible.",
                                                        })
                                                        .then((res) => {
                                                            if (res.response === 1) return;
                                                            dispatch(resetAllTheme());
                                                        });
                                                }
                                            });
                                    }}
                                >
                                    Reset Themes
                                </button>
                                <button
                                    onClick={() => {
                                        window.dialog
                                            .confirm({
                                                title: "Confirm",
                                                message: "Reset Shortcuts to default?",
                                                noOption: false,
                                            })
                                            .then((res) => {
                                                if (res.response === 0) {
                                                    dispatch(resetShortcuts());
                                                }
                                            });
                                    }}
                                >
                                    Reset Shortcuts
                                </button>
                                <button
                                    onClick={() => {
                                        window.dialog
                                            .warn({
                                                title: "Reset Settings",
                                                message:
                                                    "This will reset all Settings (themes not included). Continue?",
                                                noOption: false,
                                            })
                                            .then(({ response }) => {
                                                if (response == undefined) return;
                                                if (response === 1) return;
                                                if (response === 0) {
                                                    window.dialog
                                                        .warn({
                                                            title: "Reset Settings",
                                                            noOption: false,
                                                            message:
                                                                "Are you really sure you want to reset settings?\nThis process is irreversible.",
                                                        })
                                                        .then((res) => {
                                                            if (res.response === 1) return;
                                                            dispatch(makeNewSettings());
                                                            dispatch(resetShortcuts());
                                                        });
                                                }
                                            });
                                    }}
                                >
                                    Reset Settings
                                </button>
                            </div>
                            {/* <label className={appSettings.disableCachingCanvas ? "selected" : ""}>
                                                <input
                                                    type="checkbox"
                                                    disabled={!appSettings.useCanvasBasedReader}
                                                    checked={appSettings.disableCachingCanvas}
                                                    onChange={(e) => {
                                                        setAppSettings((init) => {
                                                            init.disableCachingCanvas = e.currentTarget.checked;
                                                            return {...init}
                        
                                                        });
                                                    }}
                                                />
                                                <p>
                                                    Enable low RAM usage. <br />
                                                    Drawbacks include high time lag when switching <code>Reading mode</code> or{" "}
                                                    <code>Page per Row</code>.
                                                </p>
                                            </label> */}
                        </div>
                    </div>
                </div>
                <h1>About</h1>
                <table className="content">
                    <tbody>
                        <tr className="settingItem">
                            <td className="name">Version </td>
                            <td className="current">
                                <span>{window.electron.app.getVersion()}</span>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Home</td>
                            <td className="current">
                                <button
                                    onClick={() =>
                                        window.electron.shell.openExternal(
                                            "https://github.com/mienaiyami/yomikiru/"
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon={faGithub} /> Home Page
                                </button>
                                <button
                                    onClick={() =>
                                        window.electron.shell.openExternal(
                                            "https://github.com/mienaiyami/yomikiru/discussions/categories/announcements"
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon={faGithub} /> Check Announcements
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Issues/Feature Request</td>
                            <td className="current">
                                <button
                                    // onFocus={(e) => e.currentTarget.blur()}
                                    onClick={() =>
                                        window.electron.shell.openExternal(
                                            "https://github.com/mienaiyami/yomikiru/issues/new/choose"
                                        )
                                    }
                                >
                                    <FontAwesomeIcon icon={faGithub} /> Submit Issue / Feature Request
                                </button>
                                <button
                                    onClick={(e) => {
                                        const target = e.currentTarget;
                                        target.innerText = "\u00a0".repeat(16) + "Copied!" + "\u00a0".repeat(16);
                                        window.electron.clipboard.writeText("mienaiyami0@gmail.com");
                                        setTimeout(() => {
                                            target.innerText = "mienaiyami0@gmail.com";
                                        }, 3000);
                                    }}
                                >
                                    mienaiyami0@gmail.com
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Developer</td>
                            <td className="current">
                                <button
                                    onClick={() =>
                                        window.electron.shell.openExternal("https://github.com/mienaiyami/")
                                    }
                                >
                                    <FontAwesomeIcon icon={faGithub} /> mienaiyami
                                </button>
                            </td>
                        </tr>
                        <tr className="settingItem">
                            <td className="name">Logs</td>
                            <td className="current">
                                <button
                                    onClick={() => {
                                        const filePath = window.path.join(
                                            window.electron.app.getPath("userData"),
                                            "logs/main.log"
                                        );
                                        if (process.platform === "win32")
                                            window.electron.shell.showItemInFolder(filePath);
                                        else if (process.platform === "linux")
                                            window.electron.ipcRenderer.send("showInExplorer", filePath);
                                    }}
                                >
                                    Show Local Logs
                                </button>
                                <button
                                    onClick={() =>
                                        window.electron.shell.openExternal(
                                            "https://github.com/mienaiyami/yomikiru/releases"
                                        )
                                    }
                                >
                                    Changelogs
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <h1>Usage & Features</h1>
                <div className="content features">
                    <ul>
                        <li>
                            It is recommended to set <code>Default Location</code> to the folder where you usually
                            store manga.
                        </li>
                        <li>
                            Drag and Drop support.
                            <ul>
                                <li>Dropping a folder will open the reader with that folders content.</li>
                                <li>Dropping a supported image file will open its parent folder in the reader</li>
                                <li>Dropping archive or epub file will open them in the reader</li>
                            </ul>
                        </li>
                        <li>
                            <b>Home Location tab :</b>
                            <ul>
                                <li>
                                    In location tab, click item to see its content or double-click (if enabled in
                                    settings above) to open it in reader.
                                </li>
                                <li>
                                    Open chapter in reader directly if chapter is a sub-folder of sub-folder of{" "}
                                    <code>Default Location</code>.
                                    <br />
                                    Example: If the default location is set to{" "}
                                    {process.platform === "win32" ? (
                                        <code>D:\manga</code>
                                    ) : (
                                        <code>/home/manga</code>
                                    )}{" "}
                                    and there is a folder called <code>One Piece</code> within it, any sub-folder
                                    located directly under <code>One Piece</code> will open automatically by
                                    clicking its link in the home location list. This feature can be enabled in the
                                    settings.
                                </li>
                            </ul>
                            <li>
                                <b>Home screen search:</b>
                                <ul>
                                    <li>
                                        You don't need to type the whole word in search. (e.g. For{" "}
                                        <code>One Piece</code> type <code>op</code>).
                                    </li>
                                    <li>
                                        Paste link to set browse pasted link in Locations tab. Or page link of a
                                        supported file to open it in reader directly.
                                    </li>
                                    <li>
                                        Type <code>..{window.path.sep}</code> to go up directory.
                                    </li>
                                    {process.platform === "win32" ? (
                                        <li>
                                            Type let <code>D:\</code> to go to <code>D drive</code>.
                                        </li>
                                    ) : (
                                        ""
                                    )}
                                    <li>
                                        Type name ending with <code>{window.path.sep}</code> to open it in search.
                                        e.g. When there is a directory named <code>One piece</code> in current
                                        list, type <code>One Piece{window.path.sep}</code> to open that as new
                                        list.
                                    </li>
                                </ul>
                            </li>
                        </li>
                        <li>
                            Collapse/Un-collapse Bookmarks, History page tabs by clicking on the Dividers beside
                            them in home screen.
                        </li>
                        <li>
                            <b>Reader :</b>
                            <ul>
                                <li>
                                    When using the <code>vertical Scroll</code> mode, you can change chapters on
                                    the first or last page by clicking on either side of the screen. No response in
                                    center 20% of screen.
                                    <ul>
                                        <li>Left &nbsp;&nbsp;= Previous Chapter</li>
                                        <li>Right = Next Chapter</li>
                                        <li>
                                            Limit width of images in reader. To use <code>Max Image Width</code>{" "}
                                            feature, disable <code>Size Clamp</code>.
                                        </li>
                                        <li>
                                            To scroll using mouse in "Left to Right" and "Right to Left" reading
                                            mode, you can use <code>Fit Vertically</code> option or make size such
                                            that there is no scrollbar.
                                        </li>
                                    </ul>
                                </li>
                                <li>
                                    Access the side list by moving the mouse to left side of the screen. You can
                                    pin and resize the side list.
                                </li>

                                <li>
                                    Zen Mode (Full Screen Mode): Hides UI, Only shows images and page number if
                                    enabled. Can be enabled using the shortcut key defined,{" "}
                                    <code>{shortcuts.find((e) => e.command === "toggleZenMode")?.key1}</code> or{" "}
                                    <code>{shortcuts.find((e) => e.command === "toggleZenMode")?.key2}</code>.
                                </li>
                            </ul>
                        </li>
                        <li>
                            Open chapter directly from the file explorer after enabling{" "}
                            <code>File Explorer Option</code>.
                            <ul>
                                <li>
                                    Right Click on folder or .cbz/.7z/.zip/.pdf/.epub
                                    &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Show more options (win11)
                                    &nbsp;&nbsp;&#8594;&nbsp;&nbsp; Open in Yomikiru.
                                </li>
                                <li>
                                    Note that this only opens the chapter containing images, not the Manga Folder.
                                </li>
                            </ul>
                        </li>
                        <li>
                            Copy theme using "Copy Current Theme to Clipboard" under theme and share it easily. To
                            install theme, just copy from anywhere and "Save Theme from Clipboard".
                        </li>
                        <li>
                            PDF Scale: Set the quality of the images. Higher number means higher quality but also
                            high initial cpu and storage usage. <br />
                            <b>Do not use high scale with pdf which have high page count.</b>
                        </li>
                        <li>
                            <b>AniList Tracking : </b>
                            <ul>
                                <li>
                                    After logging in successfully you can enable tracking by opening a manga and
                                    checking side-list (moving mouse to left most part of app).
                                </li>
                                <li>
                                    Tracker are managed according to the folder of manga. If manga folder is
                                    moved/renamed/deleted local tracker will be remove and user will need to add
                                    tracker again.
                                </li>
                                <li>
                                    Currently you need to manually update the progress entry but auto updating of
                                    tracker will be supported soon.
                                </li>
                            </ul>
                        </li>
                        <li>
                            If you know how to write <code>.css</code>, you can customize style of app, more than
                            just theme color that is enabled by "Theme Maker, by making your custom{" "}
                            <code>.css</code> file and adding it as <code>Custom Stylesheet</code>.
                            <br />
                            You can use developer/inspect tool to check the element and existing styles.
                        </li>
                    </ul>
                </div>
                <h1>Shortcut Keys</h1>
                <div className="shortcutKey">
                    <ul>
                        <li>
                            <code>Backspace</code> to delete Key.
                        </li>
                        <li>
                            Reserved Keys :{" "}
                            {reservedKeys.map((e) => (
                                <span key={e}>
                                    <code>{e}</code>{" "}
                                </span>
                            ))}
                            .
                        </li>
                    </ul>
                    <table>
                        <tbody>
                            <tr>
                                <th>Function</th>
                                <th>Key</th>
                            </tr>
                            {shortcuts.map((e, i) => (
                                <tr key={e.command}>
                                    <td>{e.name}</td>
                                    <td>
                                        <ShortcutInput which="key1" i={i} />
                                        <ShortcutInput which="key2" i={i} />
                                    </td>
                                </tr>
                            ))}
                            <tr>
                                <td>New Window</td>
                                <td>
                                    <code>ctrl</code>+<code>n</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Close Window</td>
                                <td>
                                    <code>ctrl</code>+<code>w</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Reader width</td>
                                <td>
                                    <code>ctrl</code>+<code>scroll</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Home</td>
                                <td>
                                    <code>h</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Reload UI</td>
                                <td>
                                    <code>ctrl</code>+<code>r</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Reload UI and try to clear cache</td>
                                <td>
                                    <code>ctrl</code>+<code>shift</code>+<code>r</code>
                                </td>
                            </tr>
                            <tr>
                                <td>UI Scale Up</td>
                                <td>
                                    <code>ctrl</code> + <code>=</code>
                                </td>
                            </tr>
                            <tr>
                                <td>UI Scale Down</td>
                                <td>
                                    <code>ctrl</code> + <code>-</code>
                                </td>
                            </tr>
                            <tr>
                                <td>UI Scale Reset</td>
                                <td>
                                    <code>ctrl</code> + <code>0</code>
                                </td>
                            </tr>
                            <tr>
                                <td>Dev Tool</td>
                                <td>
                                    <code>ctrl</code>+<code>shift</code>+<code>i</code>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <h1>
                    Make Theme
                    <input
                        type="text"
                        defaultValue={window.app.randomString(6)}
                        ref={themeNameInputRef}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                        }}
                    />
                    <button
                        onClick={() => {
                            saveTheme();
                        }}
                    >
                        Save as New
                    </button>
                    <button
                        onClick={() => {
                            saveTheme(true);
                        }}
                    >
                        Save
                    </button>
                </h1>
                <div className="themeMaker" ref={themeMakerRef}>
                    {/* <datalist id="cssColorVariableList">
                        {Object.keys(
                            allThemes.find((e) => {
                                return e.name === theme;
                            })!.main
                        ).map((e) => (
                            <option key={e} value={`var(${e})`}>{`var(${e})`}</option>
                        ))}
                    </datalist> */}
                    <ul>
                        <li>
                            To use previously defined color, click on link button and select property frm dropdown
                            options.
                        </li>
                        <li>
                            If you want to edit existing theme, click on theme then click on plus icon then change
                            theme according to your liking.
                        </li>
                        <li>Some changes require refresh.</li>
                    </ul>
                    <table>
                        <tbody>
                            <tr>
                                <th>Property</th>
                                <th>Reset &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Link</th>
                                <th>Color-Opacity / Variable</th>
                            </tr>
                            {Object.entries(allThemes.find((e) => e.name === theme)!.main).map((e) => (
                                <tr key={e[0]} className="newThemeMakerRow">
                                    <td className="newThemeMakerProp" data-prop={e[0]}>
                                        {window.themeProps[e[0] as keyof typeof window.themeProps]}
                                    </td>
                                    {/* <td>{e[1]}</td> */}
                                    <ThemeElement color={e[1]} prop={e[0] as ThemeDataMain} />
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Settings;
