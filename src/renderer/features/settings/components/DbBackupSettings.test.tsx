import path from "node:path";
import common from "@common/i18n/locales/en/common.json";
import settings from "@common/i18n/locales/en/settings.json";
import { onInvoke } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DbBackupSettings from "./DbBackupSettings";

const okBox = (response: number) => ({ response, checkboxChecked: false });
const copy = settings.dbBackup;

/**
 * Renders {@link DbBackupSettings} with default mainSettings.
 */
const renderDbBackup = () => renderWithProviders(<DbBackupSettings />);

/**
 * Opens the collapsed backup list (fetches via `dbBackup:list`).
 */
const openBackupList = async () => {
    fireEvent.click(screen.getByRole("button", { name: copy.showBackups }));
};

describe("DbBackupSettings", () => {
    afterEach(() => {
        cleanup();
    });

    it("keeps the backup list hidden until Show backups is clicked", async () => {
        const list = vi.fn(async () => [{ fileName: "data-1000.db", createdAtMs: 1000, byteSize: 2048 }]);
        onInvoke("dbBackup:list", list);

        renderDbBackup();

        expect(screen.queryByText(copy.restore)).not.toBeInTheDocument();
        expect(list).not.toHaveBeenCalled();

        await openBackupList();

        await waitFor(() => {
            expect(screen.getByText(copy.restore)).toBeInTheDocument();
        });
        expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
    });

    it("Backup Now invokes runNow without opening the list", async () => {
        const list = vi.fn(async () => []);
        onInvoke("dbBackup:list", list);
        const runNow = vi.fn(async () => ({ ok: true }));
        onInvoke("dbBackup:runNow", runNow);

        renderDbBackup();

        fireEvent.click(screen.getByRole("button", { name: copy.backupNow }));

        await waitFor(() => {
            expect(runNow).toHaveBeenCalled();
        });
        expect(list).not.toHaveBeenCalled();
        expect(screen.queryByText(copy.empty)).not.toBeInTheDocument();
    });

    it("Backup Now refreshes the list when it is already open", async () => {
        const list = vi
            .fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ fileName: "data-2000.db", createdAtMs: 2000, byteSize: 100 }]);
        onInvoke("dbBackup:list", list);
        onInvoke("dbBackup:runNow", async () => ({ ok: true }));

        renderDbBackup();
        await openBackupList();
        await waitFor(() => {
            expect(screen.getByText(copy.empty)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: copy.backupNow }));

        await waitFor(() => {
            expect(list).toHaveBeenCalledTimes(2);
            expect(screen.getByText(copy.restore)).toBeInTheDocument();
        });
    });

    it("Show in File Explorer highlights that backup file", async () => {
        onInvoke("dbBackup:list", async () => [{ fileName: "data-1000.db", createdAtMs: 1000, byteSize: 10 }]);

        renderDbBackup();
        await openBackupList();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: common.contextMenu.showInExplorer })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: common.contextMenu.showInExplorer }));

        const expected = path.join(window.electron.app.getPath("userData"), "backups", "data-1000.db");
        expect(window.electron.showItemInFolder).toHaveBeenCalledWith(expected);
    });

    it("Restore confirms then queues dbBackup:restore", async () => {
        onInvoke("dbBackup:list", async () => [{ fileName: "data-1000.db", createdAtMs: 1000, byteSize: 10 }]);
        const restore = vi.fn(async () => ({ ok: true as const }));
        onInvoke("dbBackup:restore", restore);
        onInvoke("dialog:warn", async () => okBox(1));

        renderDbBackup();
        await openBackupList();
        await waitFor(() => {
            expect(screen.getByText(copy.restore)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: copy.restore }));

        await waitFor(() => {
            expect(restore).toHaveBeenCalledWith({ fileName: "data-1000.db" });
        });
    });

    it("Restore cancel does not invoke restore", async () => {
        onInvoke("dbBackup:list", async () => [{ fileName: "data-1000.db", createdAtMs: 1000, byteSize: 10 }]);
        const restore = vi.fn(async () => ({ ok: true as const }));
        onInvoke("dbBackup:restore", restore);
        onInvoke("dialog:warn", async () => okBox(0));

        renderDbBackup();
        await openBackupList();
        await waitFor(() => {
            expect(screen.getByText(copy.restore)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: copy.restore }));

        await waitFor(() => {
            expect(screen.getByRole("button", { name: copy.restore })).toBeEnabled();
        });
        expect(restore).not.toHaveBeenCalled();
    });

    it("Restore failure shows an error dialog", async () => {
        onInvoke("dbBackup:list", async () => [{ fileName: "data-1000.db", createdAtMs: 1000, byteSize: 10 }]);
        onInvoke("dbBackup:restore", async () => ({ ok: false as const, code: "notFound" as const }));
        onInvoke("dialog:warn", async () => okBox(1));
        const error = vi.fn(async () => okBox(0));
        onInvoke("dialog:error", error);

        renderDbBackup();
        await openBackupList();
        await waitFor(() => {
            expect(screen.getByText(copy.restore)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: copy.restore }));

        await waitFor(() => {
            expect(error).toHaveBeenCalledWith(expect.objectContaining({ message: copy.notFound }));
        });
    });

    it("Import & Restore picks a file, confirms, and queues import", async () => {
        const absolutePath = path.join("imports", "external.db");
        onInvoke("dialog:showOpenDialog", async () => ({
            canceled: false,
            filePaths: [absolutePath],
        }));
        onInvoke("dialog:warn", async () => okBox(1));
        const importRestore = vi.fn(async () => ({ ok: true as const }));
        onInvoke("dbBackup:importAndRestore", importRestore);

        renderDbBackup();

        fireEvent.click(screen.getByRole("button", { name: copy.importRestore }));

        await waitFor(() => {
            expect(importRestore).toHaveBeenCalledWith({ absolutePath });
        });
    });

    it("Import integrity failure shows the integrity error", async () => {
        const absolutePath = path.join("imports", "bad.db");
        onInvoke("dialog:showOpenDialog", async () => ({
            canceled: false,
            filePaths: [absolutePath],
        }));
        onInvoke("dialog:warn", async () => okBox(1));
        onInvoke("dbBackup:importAndRestore", async () => ({
            ok: false as const,
            code: "integrityFailed" as const,
            reason: "not ok",
        }));
        const error = vi.fn(async () => okBox(0));
        onInvoke("dialog:error", error);

        renderDbBackup();
        fireEvent.click(screen.getByRole("button", { name: copy.importRestore }));

        await waitFor(() => {
            expect(error).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: copy.importIntegrityFailed,
                    detail: "not ok",
                }),
            );
        });
    });
});
