/* Installs process-wide library Io (preload fs/path) before other renderer modules. */
import "./utils/file";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import App from "./App";
import "./styles/index.scss";
import { initRendererI18n, syncRendererI18nFromMain } from "./i18n";
import store from "./store/index";
import { createRendererLogger } from "./utils/logger";

const log = createRendererLogger("bootstrap");

const boot = async (): Promise<void> => {
    await initRendererI18n();
    await syncRendererI18nFromMain();
    ReactDOM.render(
        <Provider store={store}>
            <App />
        </Provider>,
        document.getElementById("root"),
    );
};

boot().catch((err) => {
    log.error("renderer bootstrap failed", err);
});
