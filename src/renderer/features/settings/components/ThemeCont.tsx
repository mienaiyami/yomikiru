import { faLink, faSync, faUnlink } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { newTheme, setSysBtnColor, setTheme, updateTheme } from "@store/themes";
import InputColor from "@ui/InputColor";
import InputSelect from "@ui/InputSelect";
import { colorUtils } from "@utils/color";
import { dialogUtils } from "@utils/dialog";
import { initThemeData, themeProps } from "@utils/theme";
import { randomString } from "@utils/utils";
import { type ReactElement, useEffect, useLayoutEffect, useRef, useState } from "react";

// todo: refactor, giving up for now coz too messy

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
    const [realColor, setRealColor] = useState(colorUtils.realColor(color, currentTheme));
    const [variable, setVariable] = useState(
        colorUtils.cleanVariable(color) ? color : `var(${Object.keys(themeProps)[0]})`,
    );
    const [checked, setChecked] = useState(!!colorUtils.cleanVariable(color));

    useLayoutEffect(() => {
        originalColor.current = color;
    }, []);

    useEffect(() => {
        setFirstRendered(true);
    });
    const resetValues = () => {
        setFirstRendered(false);
        setRealColor(colorUtils.realColor(color, currentTheme));
        setVariable(colorUtils.cleanVariable(color) ? color : `var(${Object.keys(themeProps)[0]})`);
        setChecked(!!colorUtils.cleanVariable(color));
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
        if (firstRendered && colorUtils.cleanVariable(variable)) {
            const color = colorUtils.varToColor(variable, currentTheme);
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
                        options={Object.entries(themeProps)
                            .filter((e) => e[0] !== prop)
                            .map((e) => ({ label: e[1], value: `var(${e[0]})` }))}
                        onChange={(value) => {
                            setVariable(value);
                        }}
                    ></InputSelect>
                ) : (
                    <InputColor
                        value={realColor}
                        timeout={[
                            500,
                            (value) => {
                                setRealColor(colorUtils.new(value));
                            },
                        ]}
                        title="Color"
                    />
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
        Object.entries(themeProps).map((e) => ({
            prop: e[0] as ThemeDataMain,
            label: e[1],
            value: allThemes.find((e) => e.name === theme)!.main[e[0] as ThemeDataMain],
        })),
    );
    const [firstRendered, setFirstRendered] = useState(false);
    const themeNameInputRef = useRef<HTMLInputElement>(null);

    useLayoutEffect(() => {
        if (firstRendered) {
            setFakeCurrentTheme(
                Object.entries(themeProps).map((e) => ({
                    prop: e[0] as ThemeDataMain,
                    label: e[1],
                    value: allThemes.find((e) => e.name === theme)!.main[e[0] as ThemeDataMain],
                })),
            );
        }
    }, [theme]);
    const applyThemeTemp = () => {
        let vars = "";
        fakeCurrentTheme.forEach((e) => {
            vars += `${e.prop}:${e.value};`;
        });
        document.body.setAttribute("style", vars);
        if (process.platform === "win32") setSysBtnColor(!window.electron.currentWindow.isFocused());
    };
    const saveTheme = (saveAndReplace = false) => {
        const nameInput = themeNameInputRef.current;
        if (nameInput) {
            let name = "";
            name = nameInput.value || randomString(6);
            if (saveAndReplace) name = theme;
            if (initThemeData.allData.map((e) => e.name).includes(name)) {
                dialogUtils.customError({
                    title: "Error",
                    message: `Can't edit default themes, save as new instead.`,
                });
                return;
            }
            if (!saveAndReplace && allThemes.map((e) => e.name).includes(nameInput.value)) {
                dialogUtils.customError({
                    title: "Error",
                    message: `Theme name "${nameInput.value}" already exist, choose something else.`,
                });
                return;
            }
            const newThemeData = { ...themeProps };
            fakeCurrentTheme.forEach((e) => {
                newThemeData[e.prop] = e.value;
            });
            if (saveAndReplace) {
                dispatch(updateTheme({ themeName: name, newThemeData }));
                return;
            }
            nameInput.value = randomString(6);
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
                            Object.entries(themeProps).map((e) => ({
                                prop: e[0] as ThemeDataMain,
                                label: e[1],
                                value: allThemes.find((e) => e.name === theme)!.main[e[0] as ThemeDataMain],
                            })),
                        );
                    }}
                    title="Reset All"
                >
                    <FontAwesomeIcon icon={faSync} />
                </button>
                <span title={theme}>{theme}</span>
                <input
                    type="text"
                    defaultValue={randomString(6)}
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
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default ThemeCont;
