// In-memory metrics singleton for admin dashboard
// Resets on deploy/cold start — intentional for zero-dependency approach

const instanceStartTime = Date.now();

// --- Types ---

export interface RequestRecord {
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

export interface QueryLogEntry {
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

// --- Storage (capped arrays + maps) ---

const MAX_REQUESTS = 1000;
const MAX_QUERIES = 200;
const MAX_UNIQUE_IPS = 5000;

const requests: RequestRecord[] = [];
const queryLog: QueryLogEntry[] = [];
const routeCounts = new Map<string, number>();
const statusCounts = new Map<number, number>();
const uniqueIPs = new Set<string>();
const ipRequestCounts = new Map<string, number>();

// --- Recording ---

export function recordRequest(record: RequestRecord) {
  // Append and prune if over cap
  requests.push(record);
  if (requests.length > MAX_REQUESTS) {
    requests.splice(0, requests.length - MAX_REQUESTS);
  }

  // Update counters
  routeCounts.set(record.route, (routeCounts.get(record.route) || 0) + 1);
  statusCounts.set(record.status, (statusCounts.get(record.status) || 0) + 1);

  // Track unique IPs with cap
  if (uniqueIPs.size < MAX_UNIQUE_IPS) {
    uniqueIPs.add(record.ip);
  }
  ipRequestCounts.set(record.ip, (ipRequestCounts.get(record.ip) || 0) + 1);
}

export function recordQuery(entry: QueryLogEntry) {
  queryLog.push(entry);
  if (queryLog.length > MAX_QUERIES) {
    queryLog.splice(0, queryLog.length - MAX_QUERIES);
  }
}

// --- Metrics Snapshot ---

function maskIP(ip: string): string {
  if (ip === "unknown") return "unknown";
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }
  // IPv6 or other — mask last segment
  const segments = ip.split(":");
  if (segments.length > 1) {
    segments[segments.length - 1] = "xxxx";
    return segments.join(":");
  }
  return ip;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

// Sonnet pricing: $3/M input, $15/M output
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;
const BUDGET_LIMIT = 100; // USD

export function getMetrics() {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - instanceStartTime) / 1000);

  // --- Traffic ---
  const totalRequests = Array.from(routeCounts.values()).reduce((s, v) => s + v, 0);

  // Top 20 users by request count (IPs masked)
  const topUsers = Array.from(ipRequestCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ip, count]) => ({ ip: maskIP(ip), count }));

  // --- Performance ---
  const totalTimes = requests.map((r) => r.totalMs);
  const claudeTimes = requests.filter((r) => r.claudeMs != null).map((r) => r.claudeMs!);
  const railwayTimes = requests.filter((r) => r.railwayMs != null).map((r) => r.railwayMs!);
  const cacheHits = requests.filter((r) => r.cached).length;

  // --- Costs ---
  const totalInputTokens = requests.reduce((s, r) => s + (r.inputTokens || 0), 0);
  const totalOutputTokens = requests.reduce((s, r) => s + (r.outputTokens || 0), 0);
  const estimatedCostUSD =
    totalInputTokens * INPUT_COST_PER_TOKEN + totalOutputTokens * OUTPUT_COST_PER_TOKEN;

  // --- Recent queries (last 50) ---
  const recentQueries = queryLog.slice(-50).reverse().map((q) => ({
    ...q,
    ip: maskIP(q.ip),
    ago: `${Math.floor((now - q.timestamp) / 1000)}s ago`,
  }));

  return {
    uptime: {
      startTime: new Date(instanceStartTime).toISOString(),
      seconds: uptimeSeconds,
    },
    traffic: {
      totalRequests,
      uniqueUsers: uniqueIPs.size,
      byRoute: Object.fromEntries(routeCounts),
      byStatus: Object.fromEntries(statusCounts),
      topUsers,
    },
    performance: {
      total: { avg: Math.round(avg(totalTimes)), p95: Math.round(percentile(totalTimes, 95)) },
      claude: { avg: Math.round(avg(claudeTimes)), p95: Math.round(percentile(claudeTimes, 95)) },
      railway: { avg: Math.round(avg(railwayTimes)), p95: Math.round(percentile(railwayTimes, 95)) },
      cacheHitRate: totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0,
      sampleSize: requests.length,
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
