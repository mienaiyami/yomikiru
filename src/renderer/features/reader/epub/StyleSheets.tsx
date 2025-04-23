import * as css from "css";
import { memo } from "react";

const StyleSheets = memo(
    ({ sheets }: { sheets: string[] }) => {
        return (
            <div
                className="stylesheets"
                ref={(node) => {
                    if (node) {
                        sheets.forEach(async (url) => {
                            try {
                                const stylesheet = document.createElement("style");
                                let txt = await window.fs.readFile(url, "utf-8");
                                const matches = Array.from(txt.matchAll(/url\((.*?)\);/gi));
                                matches.forEach((e) => {
                                    // for font
                                    let originalURL = e[1];
                                    if (originalURL.startsWith(`'`) || originalURL.startsWith(`"`))
                                        originalURL = originalURL.slice(1, -1);
                                    txt = txt.replaceAll(
                                        e[1],
                                        `"file://${window.path
                                            .join(window.path.dirname(url), originalURL)
                                            .replaceAll("\\", "/")}"`,
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
StyleSheets.displayName = "StyleSheets";

export default StyleSheets;
