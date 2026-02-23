import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
