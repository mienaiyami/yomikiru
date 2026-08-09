import { onInvoke } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import { dialogUtils } from "./dialog";

const okBox = { response: 0, checkboxChecked: false };

describe("dialogUtils", () => {
    it("forwards nodeError / customError / warn / confirm to IPC", async () => {
        onInvoke("dialog:nodeError", async () => okBox);
        onInvoke("dialog:error", async () => okBox);
        onInvoke("dialog:warn", async (req) => {
            expect(req.buttons).toEqual(["Yes", "No"]);
            expect(req.defaultId).toBe(1);
            expect(req.cancelId).toBe(1);
            return okBox;
        });
        onInvoke("dialog:confirm", async (req) => {
            expect(req.type).toBe("question");
            expect(req.cancelId).toBe(1);
            return okBox;
        });

        await expect(
            dialogUtils.nodeError(Object.assign(new Error("e"), { name: "Error", errno: 1 })),
        ).resolves.toEqual(okBox);
        await expect(dialogUtils.customError({ message: "m", log: false })).resolves.toEqual(okBox);
        await expect(dialogUtils.warn({ message: "w", noOption: false })).resolves.toEqual(okBox);
        await expect(dialogUtils.confirm({ message: "c", noOption: false, type: "question" })).resolves.toEqual(
            okBox,
        );
    });

    it("forwards open/save dialogs", async () => {
        onInvoke("dialog:showOpenDialog", async () => ({ canceled: true, filePaths: [] }));
        onInvoke("dialog:showSaveDialog", async () => ({ canceled: true, filePath: "" }));
        await expect(dialogUtils.showOpenDialog({ properties: ["openFile"] })).resolves.toMatchObject({
            canceled: true,
        });
        await expect(dialogUtils.showSaveDialog({})).resolves.toMatchObject({ canceled: true });
    });

    it("keeps custom buttons when provided for warn", async () => {
        const handler = vi.fn(async () => okBox);
        onInvoke("dialog:warn", handler);
        await dialogUtils.warn({
            message: "w",
            noOption: false,
            buttons: ["A", "B"],
            defaultId: 0,
        });
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ buttons: ["A", "B"], defaultId: 0 }));
    });
});
