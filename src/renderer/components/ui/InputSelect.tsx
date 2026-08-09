import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { createRendererLogger } from "@utils/logger";
import type React from "react";
import { useLayoutEffect, useState } from "react";
import { useAppContext } from "../../App";

const log = createRendererLogger("components/ui/InputSelect");

// todo: replace with radix ui

const InputSelect: React.FC<{
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
}> = ({
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
}) => {
    const [btnLabel, setBtnLabel] = useState(".");

    const { setOptSelectData } = useAppContext();

    useLayoutEffect(() => {
        const selected = options.find((e) => e.value === value);
        if (selected) {
            setBtnLabel(selected.label);
            return;
        }
        // empty options usually means the parent is still loading async choices
        if (options.length > 0) {
            log.error(`value "${value}" not in options list`);
        }
    }, [value, options]);

    // making it a component will cause re-render and issues

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
