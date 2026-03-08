/**
 * Analytics & Audit Export routes — admin only.
 * Agent performance, execution trends, tool frequency, audit CSV/JSON export.
 */

import { Hono } from "hono";
import type { Env } from "../types";
import { isAdmin } from "../adminAuth";
import { checkRateLimit } from "../rateLimit";
import { ADMIN_RATE_LIMIT, ADMIN_RATE_WINDOW_MS } from "../constants";

const analytics = new Hono<{ Bindings: Env }>();

// Admin middleware
analytics.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(c.env.DB, `admin:${ip}`, ADMIN_RATE_LIMIT, ADMIN_RATE_WINDOW_MS);
  if (!rl.allowed) return c.json({ error: "Too many requests" }, 429);
  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

// GET /analytics/performance — per-agent metrics
analytics.get("/performance", async (c) => {
  const days = parseInt(c.req.query("days") || "30");

  const result = await c.env.DB.prepare(
    `SELECT
       a.slug, a.name, a.icon, a.category,
       COUNT(ul.id) as total_executions,
       COUNT(CASE WHEN ul.created_at >= datetime('now', '-7 days') THEN 1 END) as executions_7d,
       ROUND(AVG(ul.response_time_ms)) as avg_response_ms,
       ROUND(SUM(CASE WHEN ul.status = 'error' THEN 1.0 ELSE 0.0 END) * 100 / MAX(COUNT(ul.id), 1), 1) as error_rate,
       ROUND(AVG(ul.input_tokens + ul.output_tokens)) as avg_tokens
     FROM agents a
     LEFT JOIN usage_logs ul ON a.id = ul.agent_id
       AND ul.created_at >= datetime('now', '-' || ? || ' days')
     GROUP BY a.id
     ORDER BY total_executions DESC`,
  )
    .bind(days)
    .all();

  // Get average ratings per agent
  const ratings = await c.env.DB.prepare(
    `SELECT al.agent_slug, ROUND(AVG(f.rating), 2) as avg_rating, COUNT(f.id) as rating_count
     FROM feedback f
     JOIN audit_logs al ON f.audit_log_id = al.id
     GROUP BY al.agent_slug`,
  ).all<{ agent_slug: string; avg_rating: number; rating_count: number }>();

  const ratingMap = new Map(
    ratings.results.map((r) => [r.agent_slug, { avg_rating: r.avg_rating, rating_count: r.rating_count }]),
  );

  const agents = result.results.map((a: Record<string, unknown>) => ({
    ...a,
    avg_rating: ratingMap.get(a.slug as string)?.avg_rating || null,
    rating_count: ratingMap.get(a.slug as string)?.rating_count || 0,
  }));

  return c.json({ agents, period_days: days });
});

// GET /analytics/trends — daily execution counts (last 30 days)
analytics.get("/trends", async (c) => {
  const days = parseInt(c.req.query("days") || "30");

  const result = await c.env.DB.prepare(
    `SELECT
       DATE(created_at) as date,
       COUNT(*) as executions,
       COUNT(DISTINCT user_id) as unique_users,
       ROUND(AVG(response_time_ms)) as avg_response_ms,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
       SUM(input_tokens + output_tokens) as total_tokens
     FROM usage_logs
     WHERE created_at >= datetime('now', '-' || ? || ' days')
     GROUP BY DATE(created_at)
     ORDER BY date`,
  )
    .bind(days)
    .all();

  return c.json({ trends: result.results, period_days: days });
});

// GET /analytics/tools — tool call frequency
analytics.get("/tools", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT
       tool_name,
       COUNT(*) as call_count,
       ROUND(AVG(duration_ms)) as avg_duration_ms,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
     FROM agent_steps
     WHERE step_type = 'tool_call'
     GROUP BY tool_name
     ORDER BY call_count DESC`,
  ).all();

  return c.json({ tools: result.results });
});

// GET /analytics/providers — LLM provider distribution
analytics.get("/providers", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT
       llm_provider,
       llm_model,
       COUNT(*) as count,
       ROUND(AVG(response_time_ms)) as avg_response_ms,
       SUM(input_tokens) as total_input_tokens,
       SUM(output_tokens) as total_output_tokens
     FROM usage_logs
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY llm_provider, llm_model
     ORDER BY count DESC`,
  ).all();

  return c.json({ providers: result.results });
});

// GET /analytics/satisfaction — rating distribution + trends
analytics.get("/satisfaction", async (c) => {
  const distribution = await c.env.DB.prepare(
    `SELECT rating, COUNT(*) as count
     FROM feedback
     GROUP BY rating
     ORDER BY rating`,
  ).all();

  const trend = await c.env.DB.prepare(
    `SELECT DATE(f.created_at) as date, ROUND(AVG(f.rating), 2) as avg_rating, COUNT(*) as count
     FROM feedback f
     WHERE f.created_at >= datetime('now', '-30 days')
     GROUP BY DATE(f.created_at)
     ORDER BY date`,
  ).all();

  const overall = await c.env.DB.prepare(
    `SELECT ROUND(AVG(rating), 2) as avg, COUNT(*) as total FROM feedback`,
  ).first<{ avg: number; total: number }>();

  return c.json({
    distribution: distribution.results,
    trend: trend.results,
    overall: { avg_rating: overall?.avg || 0, total_ratings: overall?.total || 0 },
  });
});

// GET /analytics/export — audit log export (CSV or JSON)
analytics.get("/export", async (c) => {
  const format = c.req.query("format") || "json";
  const from = c.req.query("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
  const to = c.req.query("to") || new Date().toISOString().split("T")[0];
  const agentSlug = c.req.query("agent") || null;

  let query = `
    SELECT
      al.id as audit_id,
      al.created_at as timestamp,
      a.name as agent_name,
      a.slug as agent_slug,
      u.email as user_email,
      al.input_text,
      al.output_text,
      al.llm_provider,
      al.llm_model,
      al.temperature,
      al.max_tokens,
      al.tool_calls,
      f.rating,
      f.comment as feedback_comment,
      ul.response_time_ms,
      ul.input_tokens,
      ul.output_tokens,
      ul.status
    FROM audit_logs al
    LEFT JOIN agents a ON al.agent_id = a.id
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN usage_logs ul ON al.usage_log_id = ul.id
    LEFT JOIN feedback f ON f.audit_log_id = al.id
    WHERE DATE(al.created_at) >= ? AND DATE(al.created_at) <= ?
  `;

  const bindings: (string | null)[] = [from, to];

  if (agentSlug) {
    query += " AND a.slug = ?";
    bindings.push(agentSlug);
  }

  query += " ORDER BY al.created_at DESC LIMIT 10000";

  const result = await c.env.DB.prepare(query).bind(...bindings).all();

  if (format === "csv") {
    const rows = result.results as Record<string, unknown>[];
    if (rows.length === 0) {
      return new Response("No data found", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            const str = String(val).replace(/"/g, '""');
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str}"`
              : str;
          })
          .join(","),
      ),
    ];

    return new Response(csvLines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-export-${from}-to-${to}.csv"`,
      },
    });
  }

  return c.json({
    export: result.results,
    meta: { from, to, count: result.results.length, format: "json" },
  });
});

export default analytics;
