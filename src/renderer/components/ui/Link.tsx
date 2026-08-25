import i18n from "@renderer/i18n";
import { dialogUtils } from "@utils/dialog";
import type React from "react";

type LinkProps = {
    href: string;
    tabIndex?: number;
    confirmOpen?: boolean;
    children: React.ReactNode;
};

/**
 * Opens {@link LinkProps.href} in the system browser from an in-app control.
 */
const Link = ({ href, tabIndex = 0, confirmOpen = true, children }: LinkProps) => {
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
                            message: i18n.t("link.openUrlInBrowser"),
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
