import { ReactElement, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLink, faSync, faUnlink } from "@fortawesome/free-solid-svg-icons";
import themesRaw from "../../themeInit.json";
import { newTheme, updateTheme, setTheme, setSysBtnColor } from "../../store/themes";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { InputSelect } from "../Element/InputSelect";
import InputColor from "../Element/InputColor";
const ThemeElement = ({
    color,
    prop,
    currentTheme,
    changeValue,
}: {
    color: string;
    prop: ThemeDataMain;
    currentTheme: ThemeData["main"];
    changeValue: (prop: ThemeDataMain, value: string) => void;
}): ReactElement => {
    const ref = useRef<HTMLInputElement>(null);
    const originalColor = useRef<string | null>(null);
    const [firstRendered, setFirstRendered] = useState(false);
    const [realColor, setRealColor] = useState(window.color.realColor(color, currentTheme));
    const [variable, setVariable] = useState(
        window.color.cleanVariable(color) ? color : `var(${Object.keys(window.themeProps)[0]})`
    );
    const [checked, setChecked] = useState(!!window.color.cleanVariable(color));

    useLayoutEffect(() => {
        originalColor.current = color;
    }, []);

    useEffect(() => {
        setFirstRendered(true);
    });
    const resetValues = () => {
        setFirstRendered(false);
        setRealColor(window.color.realColor(color, currentTheme));
        setVariable(window.color.cleanVariable(color) ? color : `var(${Object.keys(window.themeProps)[0]})`);
        setChecked(!!window.color.cleanVariable(color));
    };
    useEffect(() => {
        if (firstRendered) {
            resetValues();
        }
    }, [color]);
    useLayoutEffect(() => {
        if (firstRendered) {
            changeValue(prop, checked ? variable : realColor.hexa());
        }
    }, [realColor, checked]);
    useLayoutEffect(() => {
        if (firstRendered && window.color.cleanVariable(variable)) {
            const color = window.color.varToColor(variable, currentTheme);
            if (color && color.hexa() !== realColor.hexa()) {
                setRealColor(color);
            }
        }
    }, [variable]);
    return (
        <>
            <td>
                <button
                    className="resetBtn"
                    onClick={() => {
                        if (originalColor.current) changeValue(prop, originalColor.current);
                    }}
                    title="Reset"
                >
                    <FontAwesomeIcon icon={faSync} />
                </button>
                <label
                    className={`${variable === `var(${prop})` ? "disabled" : ""} ${checked ? "selected" : ""}`}
                    title="Link to variable"
                    onKeyDown={(e) => {
                        if ([" ", "Enter"].includes(e.key)) {
                            e.preventDefault();
                            e.currentTarget.click();
                        }
                    }}
                    tabIndex={variable === `var(${prop})` ? -1 : 0}
                >
                    <input
                        type="checkbox"
                        // check if need checked
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
                        value={variable}
                        className="newThemeMakerVar"
                        options={Object.entries(window.themeProps)
                            .filter((e) => e[0] !== prop)
                            .map((e) => ({ label: e[1], value: `var(${e[0]})` }))}
                        onChange={(value) => {
                            setVariable(value);
                        }}
                    ></InputSelect>
                ) : (
                    <>
                        <InputColor
                            value={realColor}
                            timeout={[
                                500,
                                (value) => {
                                    setRealColor(window.color.new(value));
                                },
                            ]}
                            title="Color"
                        />
                    </>
                )}
            </td>
        </>
    );
};

const ThemeCont = () => {
    const theme = useAppSelector((store) => store.theme.name);
    const allThemes = useAppSelector((store) => store.theme.allData);

    const dispatch = useAppDispatch();

    const [fakeCurrentTheme, setFakeCurrentTheme] = useState(
        Object.entries(window.themeProps).map((e) => ({
            prop: e[0] as ThemeDataMain,
            label: e[1],
            value: allThemes.find((e) => e.name === theme)!.main[e[0] as ThemeDataMain],
        }))
    );
    const [firstRendered, setFirstRendered] = useState(false);
    const themeNameInputRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        if (firstRendered) {
            setFakeCurrentTheme(
                Object.entries(window.themeProps).map((e) => ({
                    prop: e[0] as ThemeDataMain,
                    label: e[1],
                    value: allThemes.find((e) => e.name === theme)!.main[e[0] as ThemeDataMain],
                }))
            );
        }
    }, [theme]);
    const applyThemeTemp = () => {
        let vars = "";
        fakeCurrentTheme.forEach((e) => {
            vars += `${e.prop}:${e.value};`;
        });
        document.body.setAttribute("style", vars);
        if (process.platform === "win32") setSysBtnColor(!window.electron.getCurrentWindow().isFocused());
    };
    const saveTheme = (saveAndReplace = false) => {
        const nameInput = themeNameInputRef.current;
        if (nameInput) {
            let name = "";
            name = nameInput.value || window.app.randomString(6);
            if (saveAndReplace) name = theme;
            if (themesRaw.allData.map((e) => e.name).includes(name)) {
                window.dialog.customError({
                    title: "Error",
                    message: `Can't edit default themes, save as new instead.`,
                });
                return;
            }
            if (!saveAndReplace && allThemes.map((e) => e.name).includes(nameInput.value)) {
                window.dialog.customError({
                    title: "Error",
                    message: `Theme name "${nameInput.value}" already exist, choose something else.`,
                });
                return;
            }
            const newThemeData = { ...window.themeProps };
            fakeCurrentTheme.forEach((e) => {
                newThemeData[e.prop] = e.value;
            });
            if (saveAndReplace) {
                dispatch(updateTheme({ themeName: name, newThemeData }));
                return;
            }
            nameInput.value = window.app.randomString(6);
            dispatch(newTheme({ name: name, main: newThemeData }));
            dispatch(setTheme(name));
        }
    };
    useLayoutEffect(() => {
        setFirstRendered(true);
    }, []);
    useLayoutEffect(() => {
        if (firstRendered) {
            applyThemeTemp();
        }
    }, [fakeCurrentTheme]);
    const changeValue = (prop: ThemeDataMain, value: string) => {
        setFakeCurrentTheme((init) => {
            const dup = [...init];
            dup.find((e) => e.prop === prop)!.value = value;
            return dup;
        });
    };

    return (
        <>
            <h1>
                <button
                    className="resetBtn"
                    onClick={() => {
                        setFakeCurrentTheme(
                            Object.entries(window.themeProps).map((e) => ({
                                prop: e[0] as ThemeDataMain,
                                label: e[1],
                                value: allThemes.find((e) => e.name === theme)!.main[e[0] as ThemeDataMain],
                            }))
                        );
                    }}
                    title="Reset All"
                >
                    <FontAwesomeIcon icon={faSync} />
                </button>
                <span title={theme}>{theme}</span>
                <input
                    type="text"
                    defaultValue={window.app.randomString(6)}
                    ref={themeNameInputRef}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                    }}
                    maxLength={20}
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
            <div className="themeMaker">
                <ul>
                    <li>
                        To use previously defined color, click on link button and select property from dropdown
                        options.
                    </li>
                    <li>Some changes may require refresh.</li>
                </ul>
                <table>
                    <tbody>
                        <tr>
                            <th>Property</th>
                            <th>Reset &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Link</th>
                            <th>Color / Variable</th>
                        </tr>
                        {fakeCurrentTheme.map((e) => (
                            <tr key={e.prop} className="newThemeMakerRow">
                                <td className="newThemeMakerProp" data-prop={e.prop}>
                                    {e.label}
                                </td>
                                <ThemeElement
                                    color={e.value}
                                    prop={e.prop}
                                    currentTheme={allThemes.find((e) => e.name === theme)!.main}
                                    changeValue={changeValue}
                                />
                            </tr>
                        ))}
                        {/* <ThemeCont theme={theme} currentTheme={currentTheme} /> */}
                        {/* {Object.entries(window.themeProps).map((e) => (
                                        <tr key={e[0]} className="newThemeMakerRow">
                                            <td className="newThemeMakerProp" data-prop={e[0]}>
                                                {e[1]}
                                            </td>
                                            <ThemeElement
                                                color={
                                                    allThemes.find((e) => e.name === theme)!.main[
                                                        e[0] as ThemeDataMain
                                                    ]
                                                }
                                                theme={theme}
                                                prop={e[0] as ThemeDataMain}
                                                applyThemeTemp={applyThemeTemp}
                                                currentTheme={currentTheme}
                                            />
                                        </tr>
                                    ))} */}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default ThemeCont;
