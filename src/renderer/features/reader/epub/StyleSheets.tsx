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
                                const scopeRule = (e: css.Node) => {
                                    if (e.type === "rule") {
                                        (e as css.Rule).selectors = (e as css.Rule).selectors?.map((s) =>
                                            s.includes("section.main") ? s : `#EPubReader section.main ${s}`,
                                        );
                                    } else if (e.type === "media") {
                                        (e as css.Media).rules?.forEach(scopeRule);
                                    }
                                };
                                ast.stylesheet?.rules.forEach(scopeRule);
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
    (prev, next) => JSON.stringify(prev.sheets) === JSON.stringify(next.sheets),
);
StyleSheets.displayName = "StyleSheets";

export default StyleSheets;
