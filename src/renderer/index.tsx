import ReactDOM from "react-dom";
import App from "./App";
import "./styles/index.scss";
import { Provider } from "react-redux";
import store from "./store/index";

ReactDOM.render(
    <Provider store={store}>
        <App />
    </Provider>,
    document.getElementById("root"),
);
