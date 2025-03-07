import React, { ReactNode, useRef, useState, useLayoutEffect, useContext } from "react";
import { useAppContext } from "../../App";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

const InputSelect = ({
    onChange,
    value,
    labelAfter,
    labelBefore,
    paraAfter,
    paraBefore,
    labeled = false,
    className = "",
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
    options: Menu.OptSelectOption[];
    disabled?: boolean;
}) => {
    const [btnLabel, setBtnLabel] = useState(".");

    const { setOptSelectData } = useAppContext();

    useLayoutEffect(() => {
        // if (value) {
        const aa = options.find((e) => e.value === value);
        if (aa) {
            setBtnLabel(aa.label);
        } else {
            window.logger.error("InputSelect::value: value not found in options.");
        }
        // }
    }, [value, options]);

    // making it a component will cause re-render and issuess

    // const SelectButton = ({ solo = true }: { solo?: boolean }) => (
    //     <button
    //         className={`optSelectBtn  ${solo ? `${disabled ? "disabled" : ""} ${className}` : ""}`}
    //         data-value={value}
    //         onClick={(e) => {
    //             setOptSelectData({
    //                 items: options.map((e) => ({
    //                     label: e.label,
    //                     disabled: e.value === value,
    //                     action() {
    //                         onChange(e.value);
    //                     },
    //                     style: e,
    //                 })),
    //                 focusBackElem: e.currentTarget,
    //                 elemBox: e.currentTarget,
    //                 onBlur() {
    //                     setOptSelectData(null);
    //                 },
    //             });
    //         }}
    //     >
    //         {btnLabel}
    //         <FontAwesomeIcon icon={faChevronDown} />
    //     </button>
    // );

    if (labeled)
        return (
            <label className={(disabled ? "disabled " : "") + className}>
                {labelBefore}
                {paraBefore && <p>{paraBefore}</p>}
                <button
                    className={`optSelectBtn`}
                    data-value={value}
                    onClick={(e) => {
                        setOptSelectData({
                            items: options.map((e) => ({
                                label: e.label,
                                selected: e.value === value,
                                action() {
                                    onChange(e.value);
                                },
                                style: { ...e.style },
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

                {paraAfter && <p>{paraAfter}</p>}
                {labelAfter}
            </label>
        );
    return (
        <button
            className={`optSelectBtn ${className}`}
            disabled={disabled}
            data-value={value}
            onClick={(e) => {
                // const textAlign = window.getComputedStyle(e.currentTarget)
                //     .textAlign as React.CSSProperties["textAlign"];
                setOptSelectData({
                    items: options.map((e) => ({
                        label: e.label,
                        selected: e.value === value,
                        action() {
                            onChange(e.value);
                        },
                        style: { ...e.style },
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
    );
};

export default InputSelect;
