import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createWriteStream, createReadStream, existsSync, readdirSync, statSync, unlinkSync } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { initDB, executeSQL, reloadViews, isReady } from "./db.js";
import { initMetricsDB, recordMetrics, getMetrics, recordFeedItem, getFeedItems } from "./metrics-db.js";

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

app.use("/concat", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!API_KEY) return next();
  if (auth !== `Bearer ${API_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/metrics/*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!API_KEY) return next();
  if (auth !== `Bearer ${API_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.use("/metrics", async (c, next) => {
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

// Stream upload a file to the data volume (handles large files without buffering)
app.post("/upload", async (c) => {
  try {
    const filename = c.req.header("X-Filename");
    if (!filename) {
      return c.json({ error: "X-Filename header required" }, 400);
    }
    const filePath = `${DATA_DIR}/${filename}`;
    console.log(`Receiving upload: ${filename} -> ${filePath}...`);

    const body = c.req.raw.body;
    if (!body) {
      return c.json({ error: "No request body" }, 400);
    }

    const append = c.req.header("X-Append") === "true";
    const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);
    const fileStream = createWriteStream(filePath, { flags: append ? "a" : "w" });
    await pipeline(nodeStream, fileStream);

    const stats = statSync(filePath);
    console.log(`Uploaded ${filename}: ${stats.size} bytes`);
    return c.json({ ok: true, path: filePath, bytes: stats.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("Upload error:", message);
    return c.json({ error: message }, 500);
  }
});

// List files in data volume
app.get("/files", (c) => {
  try {
    if (!existsSync(DATA_DIR)) return c.json({ files: [] });
    const files = readdirSync(DATA_DIR).map((f) => {
      try {
        const s = statSync(`${DATA_DIR}/${f}`);
        return { name: f, size: s.size };
      } catch {
        return { name: f, size: 0 };
      }
    });
    return c.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list files";
    return c.json({ error: message }, 500);
  }
});

// Delete a file from the data volume
app.use("/delete", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!API_KEY) return next();
  if (auth !== `Bearer ${API_KEY}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
});

app.post("/delete", async (c) => {
  try {
    const body = await c.req.json<{ filename: string }>();
    if (!body.filename) {
      return c.json({ error: "filename is required" }, 400);
    }
    const filePath = `${DATA_DIR}/${body.filename}`;
    if (!existsSync(filePath)) {
      return c.json({ error: "File not found" }, 404);
    }
    unlinkSync(filePath);
    console.log(`Deleted: ${filePath}`);
    return c.json({ ok: true, deleted: filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return c.json({ error: message }, 500);
  }
});

// Concatenate uploaded chunks into a single file
app.post("/concat", async (c) => {
  try {
    const body = await c.req.json<{ chunks: string[]; target: string }>();
    if (!body.chunks || !body.target) {
      return c.json({ error: "chunks and target are required" }, 400);
    }

    const targetPath = `${DATA_DIR}/${body.target}`;
    const writeStream = createWriteStream(targetPath);

    for (const chunk of body.chunks) {
      const chunkPath = `${DATA_DIR}/${chunk}`;
      if (!existsSync(chunkPath)) {
        writeStream.destroy();
        return c.json({ error: `Chunk not found: ${chunk}` }, 400);
      }
      await new Promise<void>((resolve, reject) => {
        const readStream = createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on("end", resolve);
        readStream.on("error", reject);
      });
    }

    writeStream.end();
    await new Promise<void>((resolve) => writeStream.on("finish", resolve));

    // Delete chunk files
    for (const chunk of body.chunks) {
      try { unlinkSync(`${DATA_DIR}/${chunk}`); } catch {}
    }

    const stats = statSync(targetPath);
    console.log(`Concatenated ${body.chunks.length} chunks -> ${body.target}: ${stats.size} bytes`);
    return c.json({ ok: true, path: targetPath, bytes: stats.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Concat failed";
    console.error("Concat error:", message);
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

// Public feed — no auth required
app.get("/feed", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const items = await getFeedItems(Math.min(limit, 100));
    return c.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch feed";
    console.error("Feed fetch error:", message);
    return c.json({ error: message }, 500);
  }
});

// Record feed item (auth required — from Vercel)
app.post("/feed/record", async (c) => {
  try {
    const body = await c.req.json();
    await recordFeedItem(body);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record feed item";
    console.error("Feed record error:", message);
    return c.json({ error: message }, 500);
  }
});

// Record metrics (fire-and-forget from Vercel)
app.post("/metrics/record", async (c) => {
  try {
    const body = await c.req.json();
    await recordMetrics(body.request || undefined, body.query || undefined);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record metrics";
    console.error("Metrics record error:", message);
    return c.json({ error: message }, 500);
  }
});

// Fetch aggregated metrics
app.get("/metrics", async (c) => {
  try {
    const metrics = await getMetrics();
    return c.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch metrics";
    console.error("Metrics fetch error:", message);
    return c.json({ error: message }, 500);
  }
});

// Start server
const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  console.log("Initializing DuckDB...");
  await initDB();
  console.log("DuckDB initialized.");

  console.log("Initializing metrics DB...");
  await initMetricsDB();
  console.log("Metrics DB initialized. Server starting...");

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`Query service listening on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
