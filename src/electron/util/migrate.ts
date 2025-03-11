import { HistoryItem, Manga_BookItem } from "@common/types/legacy";
import { DatabaseService, DB_PATH } from "../db";
import { app, dialog } from "electron";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { log } from ".";
import { pingDatabaseChange } from "@electron/ipc/database";

// migrate from 2.19.6 to sqlite
const userDataURL = app.getPath("userData");
const bookmarksPath = path.join(userDataURL, "bookmarks.json");
const historyPath = path.join(userDataURL, "history.json");

export const migrateToSqlite = async (
    db: DatabaseService,
    history: HistoryItem[],
    bookmarks: Manga_BookItem[],
) => {
    try {
        log.log("Backing up db");
        await fs.access(DB_PATH);
        const backupPath = path.join(userDataURL, `data.db-${Date.now()}.backup`);
        await fs.copyFile(DB_PATH, backupPath);
        await db.migrateFromJSON(history, bookmarks);
        await pingDatabaseChange("db:library:change");
        await pingDatabaseChange("db:bookmark:change");
        await fs.rename(bookmarksPath, path.join(userDataURL, "bookmarks.json.old"));
        await fs.rename(historyPath, path.join(userDataURL, "history.json.old"));
    } catch (error) {
        log.error("Error migrating to sqlite:", error);
        dialog.showMessageBox({
            type: "error",
            message: "Error migrating to sqlite",
            detail: String(error),
        });
    }
};

export const checkForJSONMigration = async (db: DatabaseService) => {
    const bookmarks: Manga_BookItem[] = [];
    const history: HistoryItem[] = [];
    try {
        if (existsSync(bookmarksPath)) {
            const data = await fs.readFile(bookmarksPath, "utf8");
            bookmarks.push(...JSON.parse(data));
        }
        if (existsSync(historyPath)) {
            const data = await fs.readFile(historyPath, "utf8");
            history.push(...JSON.parse(data));
        }

        if (bookmarks.length > 0 || history.length > 0) {
            const res = await dialog.showMessageBox({
                type: "question",
                message: "Found old bookmarks and history data to migrate.",
                detail:
                    "Do you want to migrate it to the new database system?\n" +
                    "You current and old data will be backed up before migration.",
                buttons: ["Yes", "No"],
                defaultId: 0,
                cancelId: 1,
            });
            if (res.response === 0) {
                await migrateToSqlite(db, history, bookmarks);
            }
        }
    } catch (error) {
        console.error("Error checking for old JSON data to migrate:", error);
    }
};
