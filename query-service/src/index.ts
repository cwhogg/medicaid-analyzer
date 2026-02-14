import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { writeFileSync, existsSync, readdirSync } from "fs";
import { initDB, executeSQL, reloadViews, isReady } from "./db.js";

const DATA_DIR = process.env.DATA_DIR || "/data";

const app = new Hono();

const API_KEY = process.env.RAILWAY_API_KEY || "";

// Auth middleware for /query and /reload
app.use("/query", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!API_KEY) return next();
  if (auth !== `Bearer ${API_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/upload", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!API_KEY) return next();
  if (auth !== `Bearer ${API_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/reload", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!API_KEY) return next();
  if (auth !== `Bearer ${API_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

// Health check
app.get("/health", (c) => {
  return c.json({ ok: true, dataReady: isReady() });
});

// Upload a file to the data volume
app.post("/upload", async (c) => {
  try {
    const filename = c.req.header("X-Filename");
    if (!filename) {
      return c.json({ error: "X-Filename header required" }, 400);
    }
    const body = await c.req.arrayBuffer();
    const filePath = `${DATA_DIR}/${filename}`;
    writeFileSync(filePath, Buffer.from(body));
    return c.json({ ok: true, path: filePath, bytes: body.byteLength });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return c.json({ error: message }, 500);
  }
});

// List files in data volume
app.get("/files", (c) => {
  try {
    if (!existsSync(DATA_DIR)) return c.json({ files: [] });
    const files = readdirSync(DATA_DIR);
    return c.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list files";
    return c.json({ error: message }, 500);
  }
});

// Reload views after uploading data files
app.post("/reload", async (c) => {
  try {
    const result = await reloadViews();
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reload failed";
    return c.json({ error: message }, 500);
  }
});

// SQL execution endpoint
app.post("/query", async (c) => {
  try {
    const body = await c.req.json<{ sql: string }>();

    if (!body.sql || typeof body.sql !== "string") {
      return c.json({ error: "sql is required and must be a string" }, 400);
    }

    // Validate SELECT-only
    const trimmed = body.sql.trim().replace(/;+$/, "").trim();
    const upper = trimmed.toUpperCase();

    if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
      return c.json({ error: "Only SELECT queries are allowed" }, 400);
    }

    const forbidden = [
      "CREATE", "DROP", "ALTER", "TRUNCATE",
      "INSERT", "UPDATE", "DELETE", "MERGE",
      "GRANT", "REVOKE", "EXEC", "EXECUTE",
      "CALL", "COPY", "ATTACH", "DETACH",
      "LOAD", "INSTALL", "PRAGMA",
    ];

    for (const kw of forbidden) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(upper)) {
        return c.json({ error: `Forbidden SQL keyword: ${kw}` }, 400);
      }
    }

    const result = await executeSQL(body.sql);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Query error:", message);
    return c.json({ error: message }, 500);
  }
});

// Start server
const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  console.log("Initializing DuckDB...");
  await initDB();
  console.log("DuckDB initialized. Server starting...");

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Query service listening on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
