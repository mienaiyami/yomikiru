import { app } from "electron";
import path from "path";
const IS_PORTABLE =
    app.isPackaged &&
    process.platform === "win32" &&
    !app.getAppPath().includes(path.dirname(app.getPath("appData")));
export default IS_PORTABLE;
