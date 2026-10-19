import { clickOnWidgetActivateKey } from "@utils/keyboard";
import { createRendererLogger } from "@utils/logger";
import type React from "react";

const log = createRendererLogger("components/ui/InputCheckbox");

const InputCheckbox = ({
    onChange,
    labelAfter,
    // labelBefore,
    paraAfter,
    // paraBefore,
    checked,
    className = "",
    disabled = false,
    title,
}: {
    labelAfter?: string;
    // labelBefore?: string;
    paraAfter?: string;
    // paraBefore?: string;
    checked: boolean;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    className?: string;
    disabled?: boolean;
    title?: string;
}) => {
    if (!labelAfter && !paraAfter) log.error("needs labelAfter or paraAfter");
    return (
        <label
            title={title}
            className={(disabled ? "disabled " : "") + (checked ? "optionSelected " : "") + className}
            onKeyDown={clickOnWidgetActivateKey}
        >
            {/* {labelBefore}
            {paraBefore && <p>{paraBefore}</p>} */}
            <span className={`toggle-area ${checked ? "on" : "off"} `} tabIndex={0}>
                <span className={`toggle-state`}></span>
            </span>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
            {/** biome-ignore lint/security/noDangerouslySetInnerHtml: <this is to make things like bold, italic work inside the para> */}
            {paraAfter && <p dangerouslySetInnerHTML={{ __html: paraAfter }}></p>}
            {labelAfter}
        </label>
    );
};

export default InputCheckbox;
