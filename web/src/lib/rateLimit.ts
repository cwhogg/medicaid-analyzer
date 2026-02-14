// --- Rate Limiting (per-IP sliding window) ---
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 30; // max requests per window

const requestLog = new Map<string, number[]>();

// Clean stale entries every 5 minutes to prevent memory leaks
let lastCleanup = Date.now();
function cleanupRequestLog() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  requestLog.forEach((timestamps, ip) => {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      requestLog.delete(ip);
    } else {
      requestLog.set(ip, valid);
    }
  });
}

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfterSec?: number } {
  cleanupRequestLog();
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (requestLog.get(ip) || []).filter((t) => t > cutoff);

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return { allowed: true, remaining: RATE_LIMIT_MAX - timestamps.length };
}
