/**
 * D1-based rate limiter — adapted from Chaosbird.
 * Sliding window counter stored in rate_limits table.
 */

export async function checkRateLimit(
  db: D1Database,
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; retryAfter: number }> {
  const now = Date.now();
  const windowStart = now - windowMs;

  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row || row.window_start < windowStart) {
    await db
      .prepare(
        `INSERT INTO rate_limits (key, count, window_start)
         VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ?`,
      )
      .bind(key, now, now)
      .run();
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 };
  }

  if (row.count >= maxRequests) {
    const retryAfter = Math.ceil((row.window_start + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  await db
    .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
    .bind(key)
    .run();

  return { allowed: true, remaining: maxRequests - row.count - 1, retryAfter: 0 };
}
