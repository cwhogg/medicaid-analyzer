import { Database } from "duckdb-async";
import path from "path";
const DATA_DIR = process.env.DATA_DIR || "/data";
const DB_PATH = path.join(DATA_DIR, "metrics.db");
let metricsDb = null;
const MAX_REQUESTS = 10_000;
const MAX_QUERIES = 1_000;
const PRUNE_INTERVAL = 100;
let insertCount = 0;
function formatAgo(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
}
export async function initMetricsDB() {
    if (metricsDb)
        return;
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
      output_tokens INTEGER DEFAULT 0,
      dataset VARCHAR DEFAULT 'medicaid'
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
      error VARCHAR,
      dataset VARCHAR DEFAULT 'medicaid'
    )
  `);
    // Add dataset column to existing tables (migration for existing DBs)
    try {
        await metricsDb.run(`ALTER TABLE requests ADD COLUMN dataset VARCHAR DEFAULT 'medicaid'`);
    }
    catch {
        // Column already exists — ignore
    }
    try {
        await metricsDb.run(`ALTER TABLE query_log ADD COLUMN dataset VARCHAR DEFAULT 'medicaid'`);
    }
    catch {
        // Column already exists — ignore
    }
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
      result_data VARCHAR,
      dataset VARCHAR DEFAULT 'medicaid'
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
    // Persistent per-user per-day activity (never pruned, used for retention cohorts)
    await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS user_daily_activity (
      ip VARCHAR NOT NULL,
      day VARCHAR NOT NULL,
      first_ts BIGINT NOT NULL,
      UNIQUE (ip, day)
    )
  `);
    // Backfill user_daily_activity from existing requests data
    await metricsDb.run(`
    INSERT OR IGNORE INTO user_daily_activity (ip, day, first_ts)
    SELECT ip, STRFTIME(DATE_TRUNC('day', EPOCH_MS(timestamp)), '%Y-%m-%d'), MIN(timestamp)
    FROM requests
    GROUP BY ip, STRFTIME(DATE_TRUNC('day', EPOCH_MS(timestamp)), '%Y-%m-%d')
  `);
    // Add result_data column if it doesn't exist (migration for existing DBs)
    try {
        await metricsDb.run(`ALTER TABLE feed_items ADD COLUMN result_data VARCHAR`);
    }
    catch {
        // Column already exists — ignore
    }
    // Add dataset column to feed_items (migration for existing DBs)
    try {
        await metricsDb.run(`ALTER TABLE feed_items ADD COLUMN dataset VARCHAR DEFAULT 'medicaid'`);
    }
    catch {
        // Column already exists — ignore
    }
    await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS shares (
      id VARCHAR PRIMARY KEY,
      data VARCHAR NOT NULL,
      timestamp BIGINT NOT NULL
    )
  `);
    await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS blog_ideas (
      id VARCHAR PRIMARY KEY,
      status VARCHAR NOT NULL DEFAULT 'pending',
      data VARCHAR NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    )
  `);
    await metricsDb.run(`
    CREATE TABLE IF NOT EXISTS tweet_metrics (
      id VARCHAR PRIMARY KEY,
      blog_idea_id VARCHAR,
      tweet_id VARCHAR,
      slug VARCHAR,
      tweet_text VARCHAR,
      recorded_at BIGINT NOT NULL,
      impressions INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      retweets INTEGER DEFAULT 0,
      replies INTEGER DEFAULT 0,
      quotes INTEGER DEFAULT 0,
      bookmarks INTEGER DEFAULT 0,
      link_clicks INTEGER DEFAULT 0,
      profile_clicks INTEGER DEFAULT 0
    )
  `);
    // Backfill dataset='medicaid' on all NULL rows (pre-filtering era, before 2026-03-02)
    await metricsDb.run(`UPDATE feed_items SET dataset = 'medicaid' WHERE dataset IS NULL`);
    await metricsDb.run(`UPDATE query_log SET dataset = 'medicaid' WHERE dataset IS NULL`);
    await metricsDb.run(`UPDATE requests SET dataset = 'medicaid' WHERE dataset IS NULL`);
    // Initialize totals row if not exists
    const existing = await metricsDb.all(`SELECT 1 FROM totals WHERE id = 1`);
    if (existing.length === 0) {
        await metricsDb.run(`INSERT INTO totals (id, total_requests, total_input_tokens, total_output_tokens, first_seen) VALUES (1, 0, 0, 0, ?)`, Date.now());
    }
    console.log(`Metrics DB initialized at ${DB_PATH}`);
}
async function maybePrune() {
    if (!metricsDb)
        return;
    insertCount++;
    if (insertCount % PRUNE_INTERVAL !== 0)
        return;
    try {
        const reqCount = await metricsDb.all(`SELECT COUNT(*) as cnt FROM requests`);
        if (reqCount[0] && reqCount[0].cnt > MAX_REQUESTS) {
            await metricsDb.run(`
        DELETE FROM requests WHERE timestamp <= (
          SELECT timestamp FROM requests ORDER BY timestamp DESC LIMIT 1 OFFSET ${MAX_REQUESTS}
        )
      `);
        }
        const qCount = await metricsDb.all(`SELECT COUNT(*) as cnt FROM query_log`);
        if (qCount[0] && qCount[0].cnt > MAX_QUERIES) {
            await metricsDb.run(`
        DELETE FROM query_log WHERE timestamp <= (
          SELECT timestamp FROM query_log ORDER BY timestamp DESC LIMIT 1 OFFSET ${MAX_QUERIES}
        )
      `);
        }
    }
    catch (err) {
        console.error("Metrics prune error:", err);
    }
}
export async function recordMetrics(request, query) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    if (request) {
        await metricsDb.run(`INSERT INTO requests (timestamp, route, ip, status, claude_ms, railway_ms, total_ms, cached, input_tokens, output_tokens, dataset)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, request.timestamp, request.route, request.ip, request.status, request.claudeMs ?? null, request.railwayMs ?? null, request.totalMs, request.cached, request.inputTokens ?? 0, request.outputTokens ?? 0, request.dataset ?? "medicaid");
        // Track daily activity (persistent, never pruned)
        const day = new Date(request.timestamp).toISOString().slice(0, 10);
        await metricsDb.run(`INSERT OR IGNORE INTO user_daily_activity (ip, day, first_ts) VALUES (?, ?, ?)`, request.ip, day, request.timestamp);
        await metricsDb.run(`UPDATE totals SET
        total_requests = total_requests + 1,
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?
       WHERE id = 1`, request.inputTokens ?? 0, request.outputTokens ?? 0);
    }
    if (query) {
        await metricsDb.run(`INSERT INTO query_log (timestamp, ip, route, question, sql_text, status, total_ms, cached, error, dataset)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, query.timestamp, query.ip, query.route, query.question, query.sql ?? null, query.status, query.totalMs, query.cached, query.error ?? null, query.dataset ?? "medicaid");
    }
    await maybePrune();
}
function maskIP(ip) {
    if (ip === "unknown")
        return "unknown";
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
async function geolocateIPs(ips) {
    const result = new Map();
    const validIPs = ips.filter(ip => ip !== "unknown");
    if (validIPs.length === 0)
        return result;
    try {
        const response = await fetch("http://ip-api.com/batch?fields=query,city,regionName", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(validIPs),
            signal: AbortSignal.timeout(5000),
        });
        if (!response.ok)
            return result;
        const data = await response.json();
        for (const entry of data) {
            const parts = [entry.city, entry.regionName].filter(Boolean);
            if (parts.length > 0) {
                result.set(entry.query, parts.join(", "));
            }
        }
    }
    catch {
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
function toNumbers(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
        out[k] = typeof v === "bigint" ? Number(v) : v;
    }
    return out;
}
function allToNumbers(rows) {
    return rows.map(toNumbers);
}
export async function getMetrics() {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    // Uptime comes from totals (unfiltered — just tracks first_seen)
    const totalsRow = allToNumbers(await metricsDb.all(`SELECT * FROM totals WHERE id = 1`));
    const totals = totalsRow[0];
    // All other metrics exclude admin/testing IPs
    const f = EXCLUDE_IP_CLAUSE;
    const trafficRow = allToNumbers(await metricsDb.all(`SELECT COUNT(*) as total_requests, SUM(input_tokens) as total_input, SUM(output_tokens) as total_output FROM requests WHERE ${f}`));
    const routeRows = allToNumbers(await metricsDb.all(`SELECT route, COUNT(*) as count FROM requests WHERE ${f} GROUP BY route`));
    const statusRows = allToNumbers(await metricsDb.all(`SELECT status, COUNT(*) as count FROM requests WHERE ${f} GROUP BY status`));
    const uniqueUsersRow = allToNumbers(await metricsDb.all(`SELECT COUNT(DISTINCT ip) as cnt FROM requests WHERE ${f}`));
    const topUsersRows = allToNumbers(await metricsDb.all(`SELECT ip, COUNT(*) as count FROM requests WHERE ${f} GROUP BY ip ORDER BY count DESC LIMIT 20`));
    const perfRows = allToNumbers(await metricsDb.all(`
    SELECT
      AVG(total_ms) as avg_total,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_ms) as p95_total,
      COUNT(*) as sample_size,
      COUNT(*) FILTER (WHERE cached = true) as cache_hits
    FROM (SELECT * FROM requests WHERE ${f} ORDER BY timestamp DESC LIMIT 1000)
  `));
    const claudePerfRows = allToNumbers(await metricsDb.all(`
    SELECT
      AVG(claude_ms) as avg_claude,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY claude_ms) as p95_claude
    FROM (SELECT claude_ms FROM requests WHERE claude_ms IS NOT NULL AND ${f} ORDER BY timestamp DESC LIMIT 1000)
  `));
    const railwayPerfRows = allToNumbers(await metricsDb.all(`
    SELECT
      AVG(railway_ms) as avg_railway,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY railway_ms) as p95_railway
    FROM (SELECT railway_ms FROM requests WHERE railway_ms IS NOT NULL AND ${f} ORDER BY timestamp DESC LIMIT 1000)
  `));
    const recentQueryRows = allToNumbers(await metricsDb.all(`SELECT * FROM query_log WHERE ${f} ORDER BY timestamp DESC LIMIT 50`));
    const perf = perfRows[0] || {};
    const claudePerf = claudePerfRows[0] || {};
    const railwayPerf = railwayPerfRows[0] || {};
    const traffic = trafficRow[0] || {};
    const totalInputTokens = Number(traffic.total_input ?? 0);
    const totalOutputTokens = Number(traffic.total_output ?? 0);
    const estimatedCostUSD = (totalInputTokens * INPUT_COST_PER_TOKEN + totalOutputTokens * OUTPUT_COST_PER_TOKEN) * COST_MULTIPLIER;
    const totalRequests = Number(traffic.total_requests ?? 0);
    const now = Date.now();
    const recentQueries = recentQueryRows.map((q) => ({
        timestamp: q.timestamp,
        ip: maskIP(String(q.ip || "unknown")),
        route: q.route,
        question: q.question,
        sql: q.sql_text,
        status: q.status,
        totalMs: q.total_ms,
        cached: q.cached,
        error: q.error || undefined,
        ago: `${formatAgo(Math.floor((now - Number(q.timestamp)) / 1000))} ago`,
    }));
    return {
        uptime: {
            startTime: totals?.first_seen ? new Date(Number(totals.first_seen)).toISOString() : new Date().toISOString(),
            seconds: totals?.first_seen ? Math.floor((now - Number(totals.first_seen)) / 1000) : 0,
        },
        traffic: {
            totalRequests,
            uniqueUsers: Number(uniqueUsersRow[0]?.cnt ?? 0),
            byRoute: Object.fromEntries(routeRows.map((r) => [r.route, Number(r.count)])),
            byStatus: Object.fromEntries(statusRows.map((r) => [r.status, Number(r.count)])),
            topUsers: await (async () => {
                const ips = topUsersRows.map((r) => String(r.ip || "unknown"));
                const geoMap = await geolocateIPs(ips);
                return topUsersRows.map((r) => {
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
export async function recordFeedItem(item) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    // Deduplicate by id
    const exists = await metricsDb.all(`SELECT 1 FROM feed_items WHERE id = ?`, item.id);
    if (exists.length > 0) {
        // Update result_data if provided on an existing item (for analyses that record metadata first, results later)
        if (item.resultData) {
            await metricsDb.run(`UPDATE feed_items SET result_data = ?, summary = COALESCE(?, summary), step_count = COALESCE(?, step_count) WHERE id = ?`, JSON.stringify(item.resultData), item.summary ?? null, item.stepCount ?? null, item.id);
        }
        return;
    }
    await metricsDb.run(`INSERT INTO feed_items (id, question, route, timestamp, summary, step_count, row_count, result_data, dataset)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, item.id, item.question, item.route, item.timestamp, item.summary ?? null, item.stepCount ?? 0, item.rowCount ?? 0, item.resultData ? JSON.stringify(item.resultData) : null, item.dataset ?? "medicaid");
    // Prune old items
    const count = await metricsDb.all(`SELECT COUNT(*) as cnt FROM feed_items`);
    if (count[0] && count[0].cnt > MAX_FEED_ITEMS) {
        await metricsDb.run(`
      DELETE FROM feed_items WHERE timestamp <= (
        SELECT timestamp FROM feed_items ORDER BY timestamp DESC LIMIT 1 OFFSET ${MAX_FEED_ITEMS}
      )
    `);
    }
}
export async function getFeedItems(limit = 50, dataset) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    let rows;
    if (dataset) {
        rows = allToNumbers(await metricsDb.all(`SELECT * FROM feed_items WHERE dataset = ? ORDER BY timestamp DESC LIMIT ?`, dataset, limit));
    }
    else {
        rows = allToNumbers(await metricsDb.all(`SELECT * FROM feed_items ORDER BY timestamp DESC LIMIT ?`, limit));
    }
    return rows.map((r) => {
        let resultData = null;
        if (r.result_data && typeof r.result_data === "string") {
            try {
                resultData = JSON.parse(r.result_data);
            }
            catch { /* ignore */ }
        }
        return {
            id: r.id,
            question: r.question,
            route: r.route,
            timestamp: r.timestamp,
            summary: r.summary || null,
            stepCount: r.step_count ?? 0,
            rowCount: r.row_count ?? 0,
            dataset: r.dataset || "medicaid",
            resultData,
        };
    });
}
export async function recordFeedback(item) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    await metricsDb.run(`INSERT INTO feedback (id, message, page, ip, timestamp) VALUES (?, ?, ?, ?, ?)`, item.id, item.message, item.page ?? null, item.ip ?? null, Date.now());
}
// --- Detailed Users ---
export async function getDetailedUsers() {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const f = EXCLUDE_IP_CLAUSE;
    const rows = allToNumbers(await metricsDb.all(`
    SELECT ip, COUNT(*) as count,
      MIN(timestamp) as first_seen, MAX(timestamp) as last_seen,
      COUNT(DISTINCT CAST(DATE_TRUNC('day', EPOCH_MS(timestamp)) AS DATE)) as active_days
    FROM requests WHERE ${f}
    GROUP BY ip ORDER BY count DESC LIMIT 100
  `));
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
export async function getDailyQueries(day) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const f = EXCLUDE_IP_CLAUSE;
    if (day) {
        // Individual queries for a specific day
        const rows = allToNumbers(await metricsDb.all(`
      SELECT timestamp, ip, route, question, sql_text, status, total_ms, cached, error
      FROM query_log
      WHERE CAST(DATE_TRUNC('day', EPOCH_MS(timestamp)) AS DATE) = ?
        AND ${f}
      ORDER BY timestamp DESC
    `, day));
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
            ago: `${formatAgo(Math.floor((now - Number(q.timestamp)) / 1000))} ago`,
        }));
    }
    // Per-day aggregates (last 90 days) with per-dataset breakdown
    const rows = allToNumbers(await metricsDb.all(`
    SELECT STRFTIME(DATE_TRUNC('day', EPOCH_MS(timestamp)), '%Y-%m-%d') as day,
      COUNT(*) as query_count, COUNT(DISTINCT ip) as unique_users,
      COUNT(*) FILTER (WHERE dataset = 'medicaid' OR dataset IS NULL) as medicaid,
      COUNT(*) FILTER (WHERE dataset = 'brfss') as brfss,
      COUNT(*) FILTER (WHERE dataset = 'medicare') as medicare,
      COUNT(*) FILTER (WHERE dataset = 'nhanes') as nhanes,
      COUNT(*) FILTER (WHERE dataset = 'medicare-inpatient') as medicare_inpatient,
      COUNT(*) FILTER (WHERE dataset = 'dac') as dac,
      COUNT(*) FILTER (WHERE dataset = 'medicare-partd') as medicare_partd
    FROM query_log WHERE ${f}
    GROUP BY day ORDER BY day DESC LIMIT 90
  `));
    return rows.map((r) => ({
        day: String(r.day),
        queryCount: Number(r.query_count),
        uniqueUsers: Number(r.unique_users),
        medicaid: Number(r.medicaid),
        brfss: Number(r.brfss),
        medicare: Number(r.medicare),
        nhanes: Number(r.nhanes),
        "medicare-inpatient": Number(r.medicare_inpatient),
        dac: Number(r.dac),
        "medicare-partd": Number(r.medicare_partd),
    }));
}
// --- Retention ---
export async function getRetention() {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const f = EXCLUDE_IP_CLAUSE;
    // 1. Day-over-day cohort (D0-D30) — uses persistent user_daily_activity table
    const cohortRows = allToNumbers(await metricsDb.all(`
    WITH user_first AS (
      SELECT ip, MIN(day) as first_day
      FROM user_daily_activity WHERE ${f} GROUP BY ip
    )
    SELECT d.day_number, COUNT(DISTINCT uda.ip) as retained,
      (SELECT COUNT(*) FROM user_first) as total
    FROM user_first uf
    JOIN user_daily_activity uda ON uf.ip = uda.ip
    CROSS JOIN (SELECT UNNEST(GENERATE_SERIES(0, 30)) as day_number) d
    WHERE DATEDIFF('day', CAST(uf.first_day AS DATE), CAST(uda.day AS DATE)) = d.day_number
    GROUP BY d.day_number ORDER BY d.day_number
  `));
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
  `));
    const eng = engagementRows[0] || {};
    const engagement = {
        total: Number(eng.total ?? 0),
        gte2: Number(eng.gte_2 ?? 0),
        gte5: Number(eng.gte_5 ?? 0),
        gte10: Number(eng.gte_10 ?? 0),
        gte25: Number(eng.gte_25 ?? 0),
        gte50: Number(eng.gte_50 ?? 0),
    };
    // 3. User recency — how many unique users active in last N days
    const now = Date.now();
    const recencyRows = allToNumbers(await metricsDb.all(`
    SELECT
      COUNT(DISTINCT ip) as total,
      COUNT(DISTINCT ip) FILTER (WHERE timestamp >= ?) as last_1d,
      COUNT(DISTINCT ip) FILTER (WHERE timestamp >= ?) as last_7d,
      COUNT(DISTINCT ip) FILTER (WHERE timestamp >= ?) as last_14d,
      COUNT(DISTINCT ip) FILTER (WHERE timestamp >= ?) as last_30d,
      COUNT(DISTINCT ip) FILTER (WHERE timestamp >= ?) as last_60d,
      COUNT(DISTINCT CASE WHEN
        ip IN (SELECT ip FROM requests WHERE ${f} GROUP BY ip HAVING COUNT(DISTINCT CAST(DATE_TRUNC('day', EPOCH_MS(timestamp)) AS DATE)) >= 2)
        THEN ip END) as multi_day_users
    FROM requests WHERE ${f}
  `, now - 86400000, now - 7 * 86400000, now - 14 * 86400000, now - 30 * 86400000, now - 60 * 86400000));
    const rec = recencyRows[0] || {};
    const recency = {
        total: Number(rec.total ?? 0),
        last1d: Number(rec.last_1d ?? 0),
        last7d: Number(rec.last_7d ?? 0),
        last14d: Number(rec.last_14d ?? 0),
        last30d: Number(rec.last_30d ?? 0),
        last60d: Number(rec.last_60d ?? 0),
        multiDayUsers: Number(rec.multi_day_users ?? 0),
    };
    return { cohort, engagement, recency };
}
// --- Shares ---
const MAX_SHARES = 5_000;
const SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
export async function saveShare(id, data) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    await metricsDb.run(`INSERT INTO shares (id, data, timestamp) VALUES (?, ?, ?)`, id, JSON.stringify(data), Date.now());
    // Prune if over limit
    const count = await metricsDb.all(`SELECT COUNT(*) as cnt FROM shares`);
    if (count[0] && count[0].cnt > MAX_SHARES) {
        await metricsDb.run(`
      DELETE FROM shares WHERE timestamp <= (
        SELECT timestamp FROM shares ORDER BY timestamp DESC LIMIT 1 OFFSET ${MAX_SHARES}
      )
    `);
    }
}
export async function getShare(id) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const rows = await metricsDb.all(`SELECT data, timestamp FROM shares WHERE id = ?`, id);
    if (rows.length === 0)
        return null;
    const row = rows[0];
    const ts = Number(row.timestamp);
    if (Date.now() - ts > SHARE_TTL_MS)
        return null; // expired
    try {
        return JSON.parse(row.data);
    }
    catch {
        return null;
    }
}
export async function getFeedback(limit = 50) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const rows = allToNumbers(await metricsDb.all(`SELECT * FROM feedback ORDER BY timestamp DESC LIMIT ?`, limit));
    return rows.map((r) => ({
        id: r.id,
        message: r.message,
        page: r.page || null,
        ip: r.ip ? maskIP(String(r.ip)) : null,
        timestamp: r.timestamp,
    }));
}
// --- Blog Ideas ---
export async function saveBlogIdeas(ideas) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const now = Date.now();
    for (const idea of ideas) {
        await metricsDb.run(`INSERT INTO blog_ideas (id, status, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`, idea.id, idea.status, idea.data, now, now);
    }
}
export async function getBlogIdeas(status) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    let rows;
    if (status) {
        rows = allToNumbers(await metricsDb.all(`SELECT * FROM blog_ideas WHERE status = ? ORDER BY created_at DESC`, status));
    }
    else {
        rows = allToNumbers(await metricsDb.all(`SELECT * FROM blog_ideas ORDER BY created_at DESC`));
    }
    return rows.map((r) => {
        let parsed = null;
        try {
            parsed = JSON.parse(r.data);
        }
        catch { /* ignore */ }
        return { id: r.id, status: r.status, data: parsed, created_at: r.created_at, updated_at: r.updated_at };
    });
}
export async function getBlogIdea(id) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const rows = await metricsDb.all(`SELECT * FROM blog_ideas WHERE id = ?`, id);
    if (rows.length === 0)
        return null;
    const r = rows[0];
    let parsed = null;
    try {
        parsed = JSON.parse(r.data);
    }
    catch { /* ignore */ }
    return { id: r.id, status: r.status, data: parsed, created_at: Number(r.created_at), updated_at: Number(r.updated_at) };
}
export async function updateBlogIdea(id, data, status) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    await metricsDb.run(`UPDATE blog_ideas SET data = ?, status = ?, updated_at = ? WHERE id = ?`, data, status, Date.now(), id);
}
export async function deleteBlogIdea(id) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    // Soft-delete: set status='deleted' and append action to data JSON
    const rows = await metricsDb.all(`SELECT data FROM blog_ideas WHERE id = ?`, id);
    if (rows.length === 0)
        return;
    let parsed = {};
    try {
        parsed = JSON.parse(rows[0].data);
    }
    catch { /* ignore */ }
    const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
    actions.push({ type: "deleted", timestamp: Date.now() });
    parsed.actions = actions;
    await metricsDb.run(`UPDATE blog_ideas SET status = 'deleted', data = ?, updated_at = ? WHERE id = ?`, JSON.stringify(parsed), Date.now(), id);
}
export async function saveTweetMetrics(input) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    const existing = await metricsDb.all(`SELECT 1 FROM tweet_metrics WHERE id = ?`, input.id);
    if (existing.length > 0) {
        // Update existing
        await metricsDb.run(`UPDATE tweet_metrics SET
        blog_idea_id = COALESCE(?, blog_idea_id),
        tweet_id = COALESCE(?, tweet_id),
        slug = COALESCE(?, slug),
        tweet_text = COALESCE(?, tweet_text),
        recorded_at = ?,
        impressions = COALESCE(?, impressions),
        likes = COALESCE(?, likes),
        retweets = COALESCE(?, retweets),
        replies = COALESCE(?, replies),
        quotes = COALESCE(?, quotes),
        bookmarks = COALESCE(?, bookmarks),
        link_clicks = COALESCE(?, link_clicks),
        profile_clicks = COALESCE(?, profile_clicks)
      WHERE id = ?`, input.blog_idea_id ?? null, input.tweet_id ?? null, input.slug ?? null, input.tweet_text ?? null, Date.now(), input.impressions ?? null, input.likes ?? null, input.retweets ?? null, input.replies ?? null, input.quotes ?? null, input.bookmarks ?? null, input.link_clicks ?? null, input.profile_clicks ?? null, input.id);
    }
    else {
        await metricsDb.run(`INSERT INTO tweet_metrics (id, blog_idea_id, tweet_id, slug, tweet_text, recorded_at, impressions, likes, retweets, replies, quotes, bookmarks, link_clicks, profile_clicks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, input.id, input.blog_idea_id ?? null, input.tweet_id ?? null, input.slug ?? null, input.tweet_text ?? null, Date.now(), input.impressions ?? 0, input.likes ?? 0, input.retweets ?? 0, input.replies ?? 0, input.quotes ?? 0, input.bookmarks ?? 0, input.link_clicks ?? 0, input.profile_clicks ?? 0);
    }
}
export async function getTweetMetrics(id) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    if (id) {
        const rows = allToNumbers(await metricsDb.all(`SELECT * FROM tweet_metrics WHERE id = ?`, id));
        return rows[0] || null;
    }
    const rows = allToNumbers(await metricsDb.all(`SELECT * FROM tweet_metrics ORDER BY recorded_at DESC`));
    return rows;
}
export async function getTopPerformingTweets(limit = 20) {
    if (!metricsDb)
        throw new Error("Metrics DB not initialized");
    // Weighted engagement score: impressions base + weighted interactions
    const rows = allToNumbers(await metricsDb.all(`
    SELECT *,
      (impressions * 0.1 + likes * 1.0 + retweets * 2.0 + replies * 1.5 + quotes * 2.0 + bookmarks * 1.5 + link_clicks * 3.0 + profile_clicks * 0.5) as engagement_score,
      CASE WHEN impressions > 0
        THEN ROUND((likes + retweets + replies + quotes + bookmarks) * 100.0 / impressions, 2)
        ELSE 0 END as engagement_rate
    FROM tweet_metrics
    WHERE impressions > 0
    ORDER BY engagement_score DESC
    LIMIT ?
  `, limit));
    return rows;
}
//# sourceMappingURL=metrics-db.js.map