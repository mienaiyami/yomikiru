import ReactDOM from "react-dom";

import "./utils/main";

import App from "./App";
import "./styles/index.scss";
import { Provider } from "react-redux";
import store from "./store/index";

// impor../public/pdfjs/pdf.min.js.js";

ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>,
    document.getElementById("root")
);
