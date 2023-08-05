import React, { ReactNode, useRef, useState, useLayoutEffect, useContext } from "react";
import { AppContext } from "../../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

export const InputSelect = ({
    onChange,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    labeled = false,
    className = "",
    children,
    options = [],
    disabled = false,
}: {
    labeled?: boolean;
    labelAfter?: string;
    labelBefore?: string;
    paraAfter?: string;
    paraBefore?: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
    //string | JSX.Element | JSX.Element[] |( () => JSX.Element)
    //ReactNode
    children?: ReactNode;
    options?: ({ label: string; value: string } | string)[];
    disabled?: boolean;
}) => {
    const [btnLabel, setBtnLabel] = useState(".");
    const { setOptSelectData } = useContext(AppContext);

    useLayoutEffect(() => {
        if (value) {
            const aa = options.find((e) => (typeof e === "string" ? e === value : e.value === value));
            if (aa) {
                if (typeof aa === "string") setBtnLabel(aa);
                else setBtnLabel(aa.label);
            }
        }
    }, [value]);

    if (labeled)
        return (
            <label className={(disabled ? "disabled " : "") + className}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}
                {/* <select
                    disabled={disabled}
                    value={value}
                    onChange={onChange}
                    onKeyDown={(e) => {
                        if (e.key !== "Escape") {
                            e.stopPropagation();
                        }
                    }}
                >
                    {children}
                    {options.map((e) => {
                        if (typeof e === "string")
                            return (
                                <option value={e} key={e}>
                                    {e}
                                </option>
                            );
                        return (
                            <option value={e.value} key={e.label}>
                                {e.label}
                            </option>
                        );
                    })}
                </select> */}
                {options && (
                    <div className={`optSelect ${disabled ? "disabled" : ""} ${className}`}>
                        <button
                            className="optSelectBtn"
                            data-value={value}
                            onClick={(e) => {
                                setOptSelectData({
                                    items: options.map((e) => ({
                                        label: typeof e === "string" ? e : e.label,
                                        disabled: false,
                                        action() {
                                            console.log(typeof e === "string" ? e : e.value);
                                            onChange(typeof e === "string" ? e : e.value);
                                            // dont do this
                                            // setDisplay(false);
                                        },
                                    })),
                                    focusBackElem: e.currentTarget,
                                    elemBox: e.currentTarget,
                                    onBlur() {
                                        setOptSelectData(null);
                                    },
                                });
                            }}
                        >
                            {btnLabel}
                            <FontAwesomeIcon icon={faChevronDown} />
                        </button>
                    </div>
                )}
                {paraAfter && <p>{paraAfter}</p>}
                {labelAfter}
            </label>
        );
    // if (!children)
    //     return (
    //         <>
    //             <button className="selectBtn">{value}</button>
    //             <div className="selectOptions">
    //                 {options.map((e) => (
    //                     <div className="selectOptionItem" key={e}>
    //                         {e}
    //                     </div>
    //                 ))}
    //             </div>
    //         </>
    //     );

    // todo, remove children totally
    // if (options && !children)
    return (
        <div className={`optSelect ${disabled ? "disabled" : ""} ${className}`}>
            <button
                className="optSelectBtn"
                data-value={value}
                onClick={(e) => {
                    setOptSelectData({
                        items: options.map((e) => ({
                            label: typeof e === "string" ? e : e.label,
                            disabled: false,
                            action() {
                                console.log(typeof e === "string" ? e : e.value);
                                onChange(typeof e === "string" ? e : e.value);
                            },
                        })),
                        focusBackElem: e.currentTarget,
                        elemBox: e.currentTarget,
                        onBlur() {
                            setOptSelectData(null);
                        },
                    });
                }}
            >
                {btnLabel}
                <FontAwesomeIcon icon={faChevronDown} />
            </button>
        </div>
    );

    // return (
    //     <select
    //         className={className}
    //         disabled={disabled}
    //         value={value}
    //         onChange={onChange}
    //         onKeyDown={(e) => {
    //             if (e.key !== "Escape") {
    //                 e.stopPropagation();
    //             }
    //         }}
    //     >
    //         {children}
    //         {options.map((e) => {
    //             if (typeof e === "string")
    //                 return (
    //                     <option value={e} key={e}>
    //                         {e}
    //                     </option>
    //                 );
    //             return (
    //                 <option value={e.value} key={e.label}>
    //                     {e.label}
    //                 </option>
    //             );
    //         })}
    //     </select>
    // );
};
