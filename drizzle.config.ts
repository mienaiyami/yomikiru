import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    out: "./drizzle",
    schema: "./src/electron/db/schema.ts",
    dialect: "sqlite",
    dbCredentials: {
        url: "file:./data.db",
    },
});
