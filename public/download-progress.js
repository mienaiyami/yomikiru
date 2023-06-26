import { ipcRenderer } from "electron";
const version = document.querySelector(".main .head span");
const text = document.querySelector(".main .progressText");
const progressElem = document.querySelector(".main .progressVisual .progress");
import "../src/styles/download.scss";

ipcRenderer.on("version", (e, ver) => {
    version.innerText = ver;
    document.title = "Downloading Yomikiru " + ver;
});
ipcRenderer.on("progress", (e, progress) => {
    text.innerText = `${(progress.transferredBytes * 0.0000009537).toFixed(1)}MB / ${(
        progress.totalBytes * 0.0000009537
    ).toFixed(1)}MB`;
    progressElem.style.width = progress.percent * 100 + "%";
});
