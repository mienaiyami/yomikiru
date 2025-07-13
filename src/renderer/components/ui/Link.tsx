import { dialogUtils } from "@utils/dialog";
import React from "react";

const Link = ({
    href,
    tabIndex = 0,
    confirmOpen = true,
    children,
}: {
    href: string;
    tabIndex?: number;
    confirmOpen?: boolean;
    children: React.ReactNode;
}) => {
    return (
        <a
            className="real-anchor"
            tabIndex={tabIndex}
            onKeyDown={(e) => {
                if ([" ", "Enter"].includes(e.key)) {
                    e.currentTarget.click();
                }
            }}
            onClick={() => {
                if (confirmOpen)
                    dialogUtils
                        .confirm({
                            message: "Open URL in Browser?",
                            detail: href,
                            noOption: false,
                        })
                        .then((res) => {
                            if (res.response === 0) window.electron.openExternal(href);
                        });
                else window.electron.openExternal(href);
            }}
        >
            {children}
        </a>
    );
};

export default Link;
