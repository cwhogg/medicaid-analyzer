import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { mkdir, writeFile } from "fs/promises";
import { executeSQL, initDB, isReady, reloadViews } from "./db.js";

const app = new Hono();
const API_KEY = process.env.RAILWAY_API_KEY || process.env.API_KEY || "";
const PORT = Number(process.env.PORT || 3011);

const auth = async (c: any, next: any) => {
  if (!API_KEY) return next();
  const h = c.req.header("Authorization");
  if (h !== `Bearer ${API_KEY}`) return c.json({ error: "Unauthorized" }, 401);
  return next();
};

app.get("/health", (c) => c.json({ ok: true, ready: isReady() }));
app.post("/reload", auth, async (c) => {
  try {
    return c.json(await reloadViews());
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post("/upload", auth, async (c) => {
  try {
    const filename = c.req.header("X-Filename") || "brfss_2023.parquet";
    const target = filename.startsWith("/") ? filename : `/tmp/${filename}`;
    await mkdir(target.substring(0, target.lastIndexOf("/")) || "/tmp", { recursive: true });
    const ab = await c.req.arrayBuffer();
    if (!ab || ab.byteLength === 0) {
      return c.json({ error: "empty body" }, 400);
    }
    await writeFile(target, Buffer.from(ab));
    return c.json({ ok: true, path: target, bytes: ab.byteLength });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post("/query", auth, async (c) => {
  try {
    const body = await c.req.json<{ sql: string }>();
    const sql = (body?.sql || "").trim();
    if (!sql) return c.json({ error: "sql is required" }, 400);

    const upper = sql.replace(/;+$/, "").trim().toUpperCase();
    if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
      return c.json({ error: "Only SELECT/WITH queries are allowed" }, 400);
    }

    const forbidden = [
      "CREATE", "DROP", "ALTER", "TRUNCATE", "INSERT", "UPDATE", "DELETE", "MERGE", "ATTACH", "DETACH", "PRAGMA", "INSTALL", "LOAD",
    ];
    for (const kw of forbidden) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(upper)) {
        return c.json({ error: `Forbidden SQL keyword: ${kw}` }, 400);
      }
    }

    const result = await executeSQL(sql);
    return c.json(result);
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

async function main() {
  await initDB();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`brfss-query-service listening on ${info.port}`);
  });
}

main().catch((e) => {
  console.error("Failed to start", e);
  process.exit(1);
});
