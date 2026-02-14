import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { initDB, executeSQL } from "./db.js";

const app = new Hono();

const API_KEY = process.env.RAILWAY_API_KEY || "";

// Auth middleware
app.use("/query", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!API_KEY) {
    // No key configured — allow (dev mode)
    return next();
  }
  if (auth !== `Bearer ${API_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

// Health check
app.get("/health", async (c) => {
  try {
    const result = await executeSQL("SELECT 1 AS ok");
    return c.json({ ok: result.rows[0]?.[0] === 1 });
  } catch {
    return c.json({ ok: false }, 500);
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
  console.log("DuckDB ready.");

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Query service listening on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
