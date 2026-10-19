import type { ClipboardChannels } from "@common/types/ipc";
import { ClipboardItem, clipboard, nativeImage } from "electron";
import { ipc } from "./utils";

/**
 * Copies PNG bytes into a Blob backed by a plain ArrayBuffer.
 * A Node Buffer's store may be a SharedArrayBuffer, which Blob rejects.
 * @param pngBytes Encoded PNG from a file decode or from the page.
 */
const pngBlob = (pngBytes: Uint8Array): Blob => {
    const copy = new Uint8Array(pngBytes.byteLength);
    copy.set(pngBytes);
    return new Blob([copy], { type: "image/png" });
};

/**
 * Registers clipboard IPC. The clipboard module is main-process only, so the
 * preload bridge invokes these handlers instead of calling it directly.
 */
export const registerClipboardHandlers = (): void => {
    ipc.handle("clipboard:readText", () => clipboard.readText());
    ipc.handle("clipboard:writeText", (_event, { text }) => clipboard.writeText(text));
    ipc.handle(
        "clipboard:copyImage",
        async (_event, source: ClipboardChannels["clipboard:copyImage"]["request"]) => {
            const pngBytes =
                "pngBytes" in source ? source.pngBytes : nativeImage.createFromPath(source.imagePath).toPNG();
            await clipboard.write([
                new ClipboardItem({
                    "image/png": pngBlob(pngBytes),
                }),
            ]);
        },
    );
};
