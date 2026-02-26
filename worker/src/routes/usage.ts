import { Hono } from "hono";
import type { Env, UserRow } from "../types";
import { getSessionUser } from "../session";
import { TRIAL_MAX_CALLS_PER_AGENT } from "../constants";

const usage = new Hono<{ Bindings: Env }>();

// GET /usage/me
usage.get("/me", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id = ?",
    ).bind(user.id),
    c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id = ? AND created_at >= date('now')",
    ).bind(user.id),
    c.env.DB.prepare(
      `SELECT agent_slug as slug, COUNT(*) as count
       FROM usage_logs WHERE user_id = ?
       GROUP BY agent_slug ORDER BY count DESC`,
    ).bind(user.id),
    c.env.DB.prepare(
      "SELECT id, key_prefix, expires_at FROM api_keys WHERE user_id = ? AND revoked = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
    ).bind(user.id),
  ]);

  const totalCalls = (results[0].results[0] as { cnt: number })?.cnt || 0;
  const callsToday = (results[1].results[0] as { cnt: number })?.cnt || 0;
  const callsByAgent = results[2].results as Array<{
    slug: string;
    count: number;
  }>;
  const activeKey = results[3].results[0] as {
    id: string;
    key_prefix: string;
    expires_at: string;
  } | null;

  // Calculate calls remaining for the active key's scope
  let callsRemaining = TRIAL_MAX_CALLS_PER_AGENT;
  if (activeKey) {
    const maxUsed = callsByAgent.reduce(
      (max, a) => Math.max(max, a.count),
      0,
    );
    callsRemaining = Math.max(0, TRIAL_MAX_CALLS_PER_AGENT - maxUsed);
  }

  return c.json({
    total_calls: totalCalls,
    calls_today: callsToday,
    calls_by_agent: callsByAgent,
    api_key: activeKey
      ? {
          expires_at: activeKey.expires_at,
          calls_remaining: callsRemaining,
        }
      : null,
  });
});

// GET /usage/quota
usage.get("/quota", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const result = await c.env.DB.prepare(
    `SELECT agent_slug, COUNT(*) as used
     FROM usage_logs WHERE user_id = ?
     GROUP BY agent_slug`,
  )
    .bind(user.id)
    .all<{ agent_slug: string; used: number }>();

  const quota: Record<string, { used: number; max: number; remaining: number }> = {};
  for (const row of result.results) {
    quota[row.agent_slug] = {
      used: row.used,
      max: TRIAL_MAX_CALLS_PER_AGENT,
      remaining: Math.max(0, TRIAL_MAX_CALLS_PER_AGENT - row.used),
    };
  }

  return c.json({ quota, max_per_agent: TRIAL_MAX_CALLS_PER_AGENT });
});

export default usage;
