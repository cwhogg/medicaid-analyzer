import { Database } from "duckdb-async";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || "/data";
const DB_PATH = path.join(DATA_DIR, "metrics.db");

let metricsDb: Database | null = null;

const MAX_REQUESTS = 10_000;
const MAX_QUERIES = 1_000;
const PRUNE_INTERVAL = 100;
let insertCount = 0;

export async function initMetricsDB(): Promise<void> {
  if (metricsDb) return;

  metricsDb = await Database.create(DB_PATH);

  await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS requests (
      timestamp BIGINT NOT NULL,
      route VARCHAR,
      ip VARCHAR,
      status INTEGER,
      claude_ms INTEGER,
      railway_ms INTEGER,
      total_ms INTEGER,
      cached BOOLEAN DEFAULT false,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0
    )
  `);

  await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS query_log (
      timestamp BIGINT NOT NULL,
      ip VARCHAR,
      route VARCHAR,
      question VARCHAR,
      sql_text VARCHAR,
      status INTEGER,
      total_ms INTEGER,
      cached BOOLEAN DEFAULT false,
      error VARCHAR
    )
  `);

  await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS totals (
      id INTEGER PRIMARY KEY DEFAULT 1,
      total_requests BIGINT DEFAULT 0,
      total_input_tokens BIGINT DEFAULT 0,
      total_output_tokens BIGINT DEFAULT 0,
      first_seen BIGINT,
      CHECK (id = 1)
    )
  `);

  await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS feed_items (
      id VARCHAR NOT NULL,
      question VARCHAR NOT NULL,
      route VARCHAR NOT NULL,
      timestamp BIGINT NOT NULL,
      summary VARCHAR,
      step_count INTEGER DEFAULT 0,
      row_count INTEGER DEFAULT 0,
      result_data VARCHAR
    )
  `);

  await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS feedback (
      id VARCHAR NOT NULL,
      message VARCHAR NOT NULL,
      page VARCHAR,
      ip VARCHAR,
      timestamp BIGINT NOT NULL
    )
  `);

  // Add result_data column if it doesn't exist (migration for existing DBs)
  try {
    await metricsDb.run(`ALTER TABLE feed_items ADD COLUMN result_data VARCHAR`);
  } catch {
    // Column already exists — ignore
  }

  // Initialize totals row if not exists
  const existing = await metricsDb.all(`SELECT 1 FROM totals WHERE id = 1`);
  if (existing.length === 0) {
    await metricsDb.run(
      `INSERT INTO totals (id, total_requests, total_input_tokens, total_output_tokens, first_seen) VALUES (1, 0, 0, 0, ?)`,
      Date.now()
    );
  }

  console.log(`Metrics DB initialized at ${DB_PATH}`);
}

async function maybePrune(): Promise<void> {
  if (!metricsDb) return;
  insertCount++;
  if (insertCount % PRUNE_INTERVAL !== 0) return;

  try {
    const reqCount = await metricsDb.all(`SELECT COUNT(*) as cnt FROM requests`);
    if (reqCount[0] && (reqCount[0] as Record<string, unknown>).cnt as number > MAX_REQUESTS) {
      await metricsDb.run(`
        DELETE FROM requests WHERE timestamp <= (
          SELECT timestamp FROM requests ORDER BY timestamp DESC LIMIT 1 OFFSET ${MAX_REQUESTS}
        )
      `);
    }

    const qCount = await metricsDb.all(`SELECT COUNT(*) as cnt FROM query_log`);
    if (qCount[0] && (qCount[0] as Record<string, unknown>).cnt as number > MAX_QUERIES) {
      await metricsDb.run(`
        DELETE FROM query_log WHERE timestamp <= (
          SELECT timestamp FROM query_log ORDER BY timestamp DESC LIMIT 1 OFFSET ${MAX_QUERIES}
        )
      `);
    }
  } catch (err) {
    console.error("Metrics prune error:", err);
  }
}

export interface RecordRequestInput {
  timestamp: number;
  route: string;
  ip: string;
  status: number;
  claudeMs?: number;
  railwayMs?: number;
  totalMs: number;
  cached: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface RecordQueryInput {
  timestamp: number;
  ip: string;
  route: string;
  question: string;
  sql: string | null;
  status: number;
  totalMs: number;
  cached: boolean;
  error?: string;
}

export async function recordMetrics(
  request?: RecordRequestInput,
  query?: RecordQueryInput
): Promise<void> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  if (request) {
    await metricsDb.run(
      `INSERT INTO requests (timestamp, route, ip, status, claude_ms, railway_ms, total_ms, cached, input_tokens, output_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      request.timestamp,
      request.route,
      request.ip,
      request.status,
      request.claudeMs ?? null,
      request.railwayMs ?? null,
      request.totalMs,
      request.cached,
      request.inputTokens ?? 0,
      request.outputTokens ?? 0
    );

    await metricsDb.run(
      `UPDATE totals SET
        total_requests = total_requests + 1,
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?
       WHERE id = 1`,
      request.inputTokens ?? 0,
      request.outputTokens ?? 0
    );
  }

  if (query) {
    await metricsDb.run(
      `INSERT INTO query_log (timestamp, ip, route, question, sql_text, status, total_ms, cached, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      query.timestamp,
      query.ip,
      query.route,
      query.question,
      query.sql ?? null,
      query.status,
      query.totalMs,
      query.cached,
      query.error ?? null
    );
  }

  await maybePrune();
}

function maskIP(ip: string): string {
  if (ip === "unknown") return "unknown";
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  const segments = ip.split(":");
  if (segments.length > 1) {
    segments[segments.length - 1] = "xxxx";
    return segments.join(":");
  }
  return ip;
}

// Batch IP geolocation via ip-api.com (free, no key needed, max 100 IPs)
async function geolocateIPs(ips: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const validIPs = ips.filter(ip => ip !== "unknown");
  if (validIPs.length === 0) return result;

  try {
    const response = await fetch("http://ip-api.com/batch?fields=query,city,regionName", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validIPs),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return result;
    const data = await response.json() as { query: string; city?: string; regionName?: string }[];
    for (const entry of data) {
      const parts = [entry.city, entry.regionName].filter(Boolean);
      if (parts.length > 0) {
        result.set(entry.query, parts.join(", "));
      }
    }
  } catch {
    // Geolocation is best-effort — don't break metrics
  }
  return result;
}

// IPs to exclude from admin metrics (admin/testing traffic)
const EXCLUDED_IP_PREFIXES = ["73.162.79."];
const EXCLUDE_IP_CLAUSE = EXCLUDED_IP_PREFIXES.map(p => `ip NOT LIKE '${p}%'`).join(" AND ");

const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;
// Tracked tokens undercount actual usage (retries, cache writes, multi-step analyses).
// 5x multiplier calibrated against real Anthropic billing.
const COST_MULTIPLIER = 5;
const BUDGET_LIMIT = 100;

// Convert all BigInt values in a row to Number
function toNumbers(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out;
}

function allToNumbers(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(toNumbers);
}

export async function getMetrics() {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  // Uptime comes from totals (unfiltered — just tracks first_seen)
  const totalsRow = allToNumbers(await metricsDb.all(`SELECT * FROM totals WHERE id = 1`) as Record<string, unknown>[]);
  const totals = totalsRow[0] as Record<string, unknown> | undefined;

  // All other metrics exclude admin/testing IPs
  const f = EXCLUDE_IP_CLAUSE;

  const trafficRow = allToNumbers(await metricsDb.all(
    `SELECT COUNT(*) as total_requests, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output FROM requests WHERE ${f}`
  ) as Record<string, unknown>[]);
  const routeRows = allToNumbers(await metricsDb.all(`SELECT route, COUNT(*) as count FROM requests WHERE ${f} GROUP BY route`) as Record<string, unknown>[]);
  const statusRows = allToNumbers(await metricsDb.all(`SELECT status, COUNT(*) as count FROM requests WHERE ${f} GROUP BY status`) as Record<string, unknown>[]);
  const uniqueUsersRow = allToNumbers(await metricsDb.all(`SELECT COUNT(DISTINCT ip) as cnt FROM requests WHERE ${f}`) as Record<string, unknown>[]);
  const topUsersRows = allToNumbers(await metricsDb.all(
    `SELECT ip, COUNT(*) as count FROM requests WHERE ${f} GROUP BY ip ORDER BY count DESC LIMIT 20`
  ) as Record<string, unknown>[]);

  const perfRows = allToNumbers(await metricsDb.all(`
    SELECT
      AVG(total_ms) as avg_total,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_ms) as p95_total,
      COUNT(*) as sample_size,
      COUNT(*) FILTER (WHERE cached = true) as cache_hits
    FROM (SELECT * FROM requests WHERE ${f} ORDER BY timestamp DESC LIMIT 1000)
  `) as Record<string, unknown>[]);

  const claudePerfRows = allToNumbers(await metricsDb.all(`
    SELECT
      AVG(claude_ms) as avg_claude,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY claude_ms) as p95_claude
    FROM (SELECT claude_ms FROM requests WHERE claude_ms IS NOT NULL AND ${f} ORDER BY timestamp DESC LIMIT 1000)
  `) as Record<string, unknown>[]);

  const railwayPerfRows = allToNumbers(await metricsDb.all(`
    SELECT
      AVG(railway_ms) as avg_railway,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY railway_ms) as p95_railway
    FROM (SELECT railway_ms FROM requests WHERE railway_ms IS NOT NULL AND ${f} ORDER BY timestamp DESC LIMIT 1000)
  `) as Record<string, unknown>[]);

  const recentQueryRows = allToNumbers(await metricsDb.all(
    `SELECT * FROM query_log WHERE ${f} ORDER BY timestamp DESC LIMIT 50`
  ) as Record<string, unknown>[]);

  const perf = (perfRows[0] as Record<string, unknown>) || {};
  const claudePerf = (claudePerfRows[0] as Record<string, unknown>) || {};
  const railwayPerf = (railwayPerfRows[0] as Record<string, unknown>) || {};

  const traffic = (trafficRow[0] as Record<string, unknown>) || {};
  const totalInputTokens = Number(traffic.total_input ?? 0);
  const totalOutputTokens = Number(traffic.total_output ?? 0);
  const estimatedCostUSD = (totalInputTokens * INPUT_COST_PER_TOKEN + totalOutputTokens * OUTPUT_COST_PER_TOKEN) * COST_MULTIPLIER;
  const totalRequests = Number(traffic.total_requests ?? 0);
  const now = Date.now();

  const recentQueries = recentQueryRows.map((q: Record<string, unknown>) => ({
    timestamp: q.timestamp,
    ip: maskIP(String(q.ip || "unknown")),
    route: q.route,
    question: q.question,
    sql: q.sql_text,
    status: q.status,
    totalMs: q.total_ms,
    cached: q.cached,
    error: q.error || undefined,
    ago: `${Math.floor((now - Number(q.timestamp)) / 1000)}s ago`,
  }));

  return {
    uptime: {
      startTime: totals?.first_seen ? new Date(Number(totals.first_seen)).toISOString() : new Date().toISOString(),
      seconds: totals?.first_seen ? Math.floor((now - Number(totals.first_seen)) / 1000) : 0,
    },
    traffic: {
      totalRequests,
      uniqueUsers: Number((uniqueUsersRow[0] as Record<string, unknown>)?.cnt ?? 0),
      byRoute: Object.fromEntries(routeRows.map((r: Record<string, unknown>) => [r.route, Number(r.count)])),
      byStatus: Object.fromEntries(statusRows.map((r: Record<string, unknown>) => [r.status, Number(r.count)])),
      topUsers: await (async () => {
        const ips = topUsersRows.map((r: Record<string, unknown>) => String(r.ip || "unknown"));
        const geoMap = await geolocateIPs(ips);
        return topUsersRows.map((r: Record<string, unknown>) => {
          const rawIP = String(r.ip || "unknown");
          return { ip: maskIP(rawIP), city: geoMap.get(rawIP) || null, count: Number(r.count) };
        });
      })(),
    },
    performance: {
      total: { avg: Math.round(Number(perf.avg_total ?? 0)), p95: Math.round(Number(perf.p95_total ?? 0)) },
      claude: { avg: Math.round(Number(claudePerf.avg_claude ?? 0)), p95: Math.round(Number(claudePerf.p95_claude ?? 0)) },
      railway: { avg: Math.round(Number(railwayPerf.avg_railway ?? 0)), p95: Math.round(Number(railwayPerf.p95_railway ?? 0)) },
      cacheHitRate: Number(perf.sample_size ?? 0) > 0 ? Math.round((Number(perf.cache_hits ?? 0) / Number(perf.sample_size)) * 100) : 0,
      sampleSize: Number(perf.sample_size ?? 0),
    },
    costs: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedUSD: Math.round(estimatedCostUSD * 100) / 100,
      budgetLimit: BUDGET_LIMIT,
      budgetPercent: Math.round((estimatedCostUSD / BUDGET_LIMIT) * 100),
    },
    recentQueries,
  };
}

// --- Public Feed ---

const MAX_FEED_ITEMS = 500;

export interface FeedItemInput {
  id: string;
  question: string;
  route: string;
  timestamp: number;
  summary?: string | null;
  stepCount?: number;
  rowCount?: number;
  resultData?: unknown;
}

export async function recordFeedItem(item: FeedItemInput): Promise<void> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  // Deduplicate by id
  const exists = await metricsDb.all(`SELECT 1 FROM feed_items WHERE id = ?`, item.id);
  if (exists.length > 0) {
    // Update result_data if provided on an existing item (for analyses that record metadata first, results later)
    if (item.resultData) {
      await metricsDb.run(
        `UPDATE feed_items SET result_data = ?, summary = COALESCE(?, summary), step_count = COALESCE(?, step_count) WHERE id = ?`,
        JSON.stringify(item.resultData),
        item.summary ?? null,
        item.stepCount ?? null,
        item.id
      );
    }
    return;
  }

  await metricsDb.run(
    `INSERT INTO feed_items (id, question, route, timestamp, summary, step_count, row_count, result_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.question,
    item.route,
    item.timestamp,
    item.summary ?? null,
    item.stepCount ?? 0,
    item.rowCount ?? 0,
    item.resultData ? JSON.stringify(item.resultData) : null
  );

  // Prune old items
  const count = await metricsDb.all(`SELECT COUNT(*) as cnt FROM feed_items`);
  if (count[0] && (count[0] as Record<string, unknown>).cnt as number > MAX_FEED_ITEMS) {
    await metricsDb.run(`
      DELETE FROM feed_items WHERE timestamp <= (
        SELECT timestamp FROM feed_items ORDER BY timestamp DESC LIMIT 1 OFFSET ${MAX_FEED_ITEMS}
      )
    `);
  }
}

export async function getFeedItems(limit = 50): Promise<Record<string, unknown>[]> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  const rows = allToNumbers(await metricsDb.all(
    `SELECT * FROM feed_items ORDER BY timestamp DESC LIMIT ?`, limit
  ) as Record<string, unknown>[]);

  return rows.map((r) => {
    let resultData = null;
    if (r.result_data && typeof r.result_data === "string") {
      try { resultData = JSON.parse(r.result_data); } catch { /* ignore */ }
    }
    return {
      id: r.id,
      question: r.question,
      route: r.route,
      timestamp: r.timestamp,
      summary: r.summary || null,
      stepCount: r.step_count ?? 0,
      rowCount: r.row_count ?? 0,
      resultData,
    };
  });
}

// --- Feedback ---

export interface FeedbackInput {
  id: string;
  message: string;
  page?: string;
  ip?: string;
}

export async function recordFeedback(item: FeedbackInput): Promise<void> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  await metricsDb.run(
    `INSERT INTO feedback (id, message, page, ip, timestamp) VALUES (?, ?, ?, ?, ?)`,
    item.id,
    item.message,
    item.page ?? null,
    item.ip ?? null,
    Date.now()
  );
}

// --- Detailed Users ---

export async function getDetailedUsers(): Promise<Record<string, unknown>[]> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  const f = EXCLUDE_IP_CLAUSE;
  const rows = allToNumbers(await metricsDb.all(`
    SELECT ip, COUNT(*) as count,
      MIN(timestamp) as first_seen, MAX(timestamp) as last_seen,
      COUNT(DISTINCT CAST(DATE_TRUNC('day', EPOCH_MS(timestamp)) AS DATE)) as active_days
    FROM requests WHERE ${f}
    GROUP BY ip ORDER BY count DESC LIMIT 100
  `) as Record<string, unknown>[]);

  const ips = rows.map((r) => String(r.ip || "unknown"));
  const geoMap = await geolocateIPs(ips);

  return rows.map((r) => {
    const rawIP = String(r.ip || "unknown");
    return {
      ip: maskIP(rawIP),
      city: geoMap.get(rawIP) || null,
      count: Number(r.count),
      firstSeen: Number(r.first_seen),
      lastSeen: Number(r.last_seen),
      activeDays: Number(r.active_days),
    };
  });
}

// --- Daily Queries ---

export async function getDailyQueries(day?: string): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  const f = EXCLUDE_IP_CLAUSE;

  if (day) {
    // Individual queries for a specific day
    const rows = allToNumbers(await metricsDb.all(`
      SELECT timestamp, ip, route, question, sql_text, status, total_ms, cached, error
      FROM query_log
      WHERE CAST(DATE_TRUNC('day', EPOCH_MS(timestamp)) AS DATE) = ?
        AND ${f}
      ORDER BY timestamp DESC
    `, day) as Record<string, unknown>[]);

    const now = Date.now();
    return rows.map((q) => ({
      timestamp: q.timestamp,
      ip: maskIP(String(q.ip || "unknown")),
      route: q.route,
      question: q.question,
      sql: q.sql_text,
      status: q.status,
      totalMs: q.total_ms,
      cached: q.cached,
      error: q.error || undefined,
      ago: `${Math.floor((now - Number(q.timestamp)) / 1000)}s ago`,
    }));
  }

  // Per-day aggregates (last 90 days)
  const rows = allToNumbers(await metricsDb.all(`
    SELECT CAST(DATE_TRUNC('day', EPOCH_MS(timestamp)) AS DATE) as day,
      COUNT(*) as query_count, COUNT(DISTINCT ip) as unique_users
    FROM query_log WHERE ${f}
    GROUP BY day ORDER BY day DESC LIMIT 90
  `) as Record<string, unknown>[]);

  return rows.map((r) => ({
    day: String(r.day),
    queryCount: Number(r.query_count),
    uniqueUsers: Number(r.unique_users),
  }));
}

// --- Retention ---

export async function getRetention(): Promise<Record<string, unknown>> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  const f = EXCLUDE_IP_CLAUSE;

  // 1. Day-over-day cohort (D0-D30)
  const cohortRows = allToNumbers(await metricsDb.all(`
    WITH user_first AS (
      SELECT ip, CAST(MIN(DATE_TRUNC('day', EPOCH_MS(timestamp))) AS DATE) as first_day
      FROM requests WHERE ${f} GROUP BY ip
    ),
    user_days AS (
      SELECT DISTINCT ip, CAST(DATE_TRUNC('day', EPOCH_MS(timestamp)) AS DATE) as day
      FROM requests WHERE ${f}
    )
    SELECT d.day_number, COUNT(DISTINCT ud.ip) as retained,
      (SELECT COUNT(*) FROM user_first) as total
    FROM user_first uf
    JOIN user_days ud ON uf.ip = ud.ip
    CROSS JOIN (SELECT UNNEST(GENERATE_SERIES(0, 30)) as day_number) d
    WHERE DATEDIFF('day', uf.first_day, ud.day) = d.day_number
    GROUP BY d.day_number ORDER BY d.day_number
  `) as Record<string, unknown>[]);

  const cohort = cohortRows.map((r) => ({
    dayNumber: Number(r.day_number),
    retained: Number(r.retained),
    total: Number(r.total),
  }));

  // 2. Engagement buckets
  const engagementRows = allToNumbers(await metricsDb.all(`
    WITH user_counts AS (
      SELECT ip, COUNT(*) as cnt FROM requests WHERE ${f} GROUP BY ip
    )
    SELECT COUNT(*) as total,
      COUNT(*) FILTER (WHERE cnt >= 2) as gte_2,
      COUNT(*) FILTER (WHERE cnt >= 5) as gte_5,
      COUNT(*) FILTER (WHERE cnt >= 10) as gte_10,
      COUNT(*) FILTER (WHERE cnt >= 25) as gte_25,
      COUNT(*) FILTER (WHERE cnt >= 50) as gte_50
    FROM user_counts
  `) as Record<string, unknown>[]);

  const eng = engagementRows[0] || {};
  const engagement = {
    total: Number(eng.total ?? 0),
    gte2: Number(eng.gte_2 ?? 0),
    gte5: Number(eng.gte_5 ?? 0),
    gte10: Number(eng.gte_10 ?? 0),
    gte25: Number(eng.gte_25 ?? 0),
    gte50: Number(eng.gte_50 ?? 0),
  };

  // 3. Return intervals
  const returnRows = allToNumbers(await metricsDb.all(`
    WITH user_first AS (
      SELECT ip, MIN(timestamp) as first_ts
      FROM requests WHERE ${f} GROUP BY ip
    ),
    user_returns AS (
      SELECT uf.ip, MIN(r.timestamp) as return_ts,
        (MIN(r.timestamp) - uf.first_ts) / 86400000.0 as days_to_return
      FROM user_first uf
      JOIN requests r ON uf.ip = r.ip AND r.timestamp > uf.first_ts + 3600000
      WHERE ${f}
      GROUP BY uf.ip, uf.first_ts
    )
    SELECT
      (SELECT COUNT(*) FROM user_first) as total,
      COUNT(*) as returned,
      COUNT(*) FILTER (WHERE days_to_return <= 1) as within_1d,
      COUNT(*) FILTER (WHERE days_to_return <= 2) as within_2d,
      COUNT(*) FILTER (WHERE days_to_return <= 7) as within_7d,
      COUNT(*) FILTER (WHERE days_to_return <= 14) as within_14d,
      COUNT(*) FILTER (WHERE days_to_return <= 30) as within_30d
    FROM user_returns
  `) as Record<string, unknown>[]);

  const ret = returnRows[0] || {};
  const returnIntervals = {
    total: Number(ret.total ?? 0),
    returned: Number(ret.returned ?? 0),
    within1d: Number(ret.within_1d ?? 0),
    within2d: Number(ret.within_2d ?? 0),
    within7d: Number(ret.within_7d ?? 0),
    within14d: Number(ret.within_14d ?? 0),
    within30d: Number(ret.within_30d ?? 0),
  };

  return { cohort, engagement, returnIntervals };
}

export async function getFeedback(limit = 50): Promise<Record<string, unknown>[]> {
  if (!metricsDb) throw new Error("Metrics DB not initialized");

  const rows = allToNumbers(await metricsDb.all(
    `SELECT * FROM feedback ORDER BY timestamp DESC LIMIT ?`, limit
  ) as Record<string, unknown>[]);

  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    page: r.page || null,
    ip: r.ip ? maskIP(String(r.ip)) : null,
    timestamp: r.timestamp,
  }));
}
