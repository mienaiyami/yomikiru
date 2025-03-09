import * as css from "css";
import { memo } from "react";

const StyleSheets = memo(
    ({ sheets }: { sheets: string[] }) => {
        return (
            <div
                className="stylesheets"
                ref={(node) => {
                    if (node) {
                        // todo check async behavior
                        sheets.forEach(async (url) => {
                            try {
                                const stylesheet = document.createElement("style");
                                let txt = await window.fs.readFile(url, "utf-8");
                                const matches = Array.from(txt.matchAll(/url\((.*?)\);/gi));
                                matches.forEach((e) => {
                                    // for font
                                    const url_old = e[1].slice(1, -1);
                                    txt = txt.replaceAll(
                                        url_old,
                                        "file://" +
                                            window.path
                                                .join(window.path.dirname(url), url_old)
                                                .replaceAll("\\", "/"),
                                    );
                                });
                                // to make sure styles don't apply outside
                                // todo, can use scope in latest version of electron
                                const ast = css.parse(txt);
                                ast.stylesheet?.rules.forEach((e) => {
                                    if (e.type === "rule") {
                                        (e as css.Rule).selectors = (e as css.Rule).selectors?.map((e) =>
                                            e.includes("section.main") ? e : "#EPubReader section.main " + e,
                                        );
                                    }
                                });
                                txt = css.stringify(ast);
                                stylesheet.innerHTML = txt;
                                node.appendChild(stylesheet);
                            } catch (e) {
                                window.logger.error("Error occurred while loading stylesheet.", e);
                            }
                        });
                    }
                }}
            ></div>
        );
    },
    (prev, next) => prev.sheets.length === next.sheets.length && prev.sheets[0] === next.sheets[0],
);

export default StyleSheets;
