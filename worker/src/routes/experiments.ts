/**
 * A/B Prompt Experiments — admin only.
 * Create experiments, route traffic, track results, declare winners.
 */

import { Hono } from "hono";
import type { Env } from "../types";
import { isAdmin } from "../adminAuth";
import { checkRateLimit } from "../rateLimit";
import { EXPERIMENT_STATUS, ADMIN_RATE_LIMIT, ADMIN_RATE_WINDOW_MS } from "../constants";

const experiments = new Hono<{ Bindings: Env }>();

// Admin middleware
experiments.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(c.env.DB, `admin:${ip}`, ADMIN_RATE_LIMIT, ADMIN_RATE_WINDOW_MS);
  if (!rl.allowed) return c.json({ error: "Too many requests" }, 429);
  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

// POST /experiments — create experiment
experiments.post("/", async (c) => {
  const body = await c.req.json<{
    agent_id: number;
    name: string;
    description?: string;
    variant_a_prompt: string;
    variant_b_prompt: string;
    traffic_split?: number;
  }>();

  if (!body.agent_id || !body.name || !body.variant_a_prompt || !body.variant_b_prompt) {
    return c.json({ error: "agent_id, name, variant_a_prompt, and variant_b_prompt are required" }, 400);
  }

  const split = body.traffic_split ?? 0.5;
  if (split < 0.1 || split > 0.9) {
    return c.json({ error: "traffic_split must be between 0.1 and 0.9" }, 400);
  }

  // Verify agent exists
  const agent = await c.env.DB.prepare("SELECT id, name FROM agents WHERE id = ?")
    .bind(body.agent_id)
    .first<{ id: number; name: string }>();
  if (!agent) return c.json({ error: "Agent not found" }, 404);

  const result = await c.env.DB.prepare(
    `INSERT INTO prompt_experiments (agent_id, name, description, variant_a_prompt, variant_b_prompt, traffic_split)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(body.agent_id, body.name, body.description || null, body.variant_a_prompt, body.variant_b_prompt, split)
    .first<{ id: number }>();

  return c.json({ experiment: { id: result?.id, ...body, status: EXPERIMENT_STATUS.DRAFT } }, 201);
});

// GET /experiments — list all experiments
experiments.get("/", async (c) => {
  const agentId = c.req.query("agent_id");

  let query = `
    SELECT pe.*, a.name as agent_name, a.slug as agent_slug
    FROM prompt_experiments pe
    JOIN agents a ON pe.agent_id = a.id
  `;
  const bindings: number[] = [];

  if (agentId) {
    query += " WHERE pe.agent_id = ?";
    bindings.push(parseInt(agentId));
  }

  query += " ORDER BY pe.created_at DESC";

  const result = bindings.length
    ? await c.env.DB.prepare(query).bind(...bindings).all()
    : await c.env.DB.prepare(query).all();

  return c.json({ experiments: result.results });
});

// GET /experiments/:id — get experiment with results summary
experiments.get("/:id", async (c) => {
  const id = c.req.param("id");

  const experiment = await c.env.DB.prepare(
    `SELECT pe.*, a.name as agent_name, a.slug as agent_slug
     FROM prompt_experiments pe
     JOIN agents a ON pe.agent_id = a.id
     WHERE pe.id = ?`,
  )
    .bind(id)
    .first();

  if (!experiment) return c.json({ error: "Experiment not found" }, 404);

  // Get results summary per variant
  const results = await c.env.DB.prepare(
    `SELECT
       variant,
       COUNT(*) as executions,
       ROUND(AVG(rating), 2) as avg_rating,
       COUNT(rating) as rated_count,
       ROUND(AVG(response_time_ms)) as avg_response_ms,
       SUM(input_tokens + output_tokens) as total_tokens,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
     FROM experiment_results
     WHERE experiment_id = ?
     GROUP BY variant`,
  )
    .bind(id)
    .all();

  // Get daily trend per variant
  const trend = await c.env.DB.prepare(
    `SELECT DATE(created_at) as date, variant, COUNT(*) as count, ROUND(AVG(rating), 2) as avg_rating
     FROM experiment_results
     WHERE experiment_id = ?
     GROUP BY DATE(created_at), variant
     ORDER BY date`,
  )
    .bind(id)
    .all();

  return c.json({
    experiment,
    results: results.results,
    trend: trend.results,
  });
});

// PUT /experiments/:id — update experiment (start, pause, complete)
experiments.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    status?: string;
    name?: string;
    description?: string;
    traffic_split?: number;
    winner?: string;
  }>();

  const existing = await c.env.DB.prepare("SELECT id, status FROM prompt_experiments WHERE id = ?")
    .bind(id)
    .first<{ id: number; status: string }>();

  if (!existing) return c.json({ error: "Experiment not found" }, 404);

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.name) {
    updates.push("name = ?");
    values.push(body.name);
  }
  if (body.description !== undefined) {
    updates.push("description = ?");
    values.push(body.description);
  }
  if (body.traffic_split !== undefined) {
    updates.push("traffic_split = ?");
    values.push(body.traffic_split);
  }

  if (body.status) {
    const validTransitions: Record<string, string[]> = {
      [EXPERIMENT_STATUS.DRAFT]: [EXPERIMENT_STATUS.RUNNING],
      [EXPERIMENT_STATUS.RUNNING]: [EXPERIMENT_STATUS.PAUSED, EXPERIMENT_STATUS.COMPLETED],
      [EXPERIMENT_STATUS.PAUSED]: [EXPERIMENT_STATUS.RUNNING, EXPERIMENT_STATUS.COMPLETED],
      [EXPERIMENT_STATUS.COMPLETED]: [],
    };

    if (!validTransitions[existing.status]?.includes(body.status)) {
      return c.json({ error: `Cannot transition from ${existing.status} to ${body.status}` }, 400);
    }

    updates.push("status = ?");
    values.push(body.status);

    if (body.status === EXPERIMENT_STATUS.RUNNING && existing.status === EXPERIMENT_STATUS.DRAFT) {
      updates.push("started_at = datetime('now')");
    }
    if (body.status === EXPERIMENT_STATUS.COMPLETED) {
      updates.push("completed_at = datetime('now')");
      if (body.winner) {
        updates.push("winner = ?");
        values.push(body.winner);
      }
    }
  }

  if (updates.length === 0) return c.json({ error: "Nothing to update" }, 400);

  values.push(parseInt(id));
  await c.env.DB.prepare(`UPDATE prompt_experiments SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true });
});

// DELETE /experiments/:id — delete experiment
experiments.delete("/:id", async (c) => {
  const id = c.req.param("id");

  // Delete results first
  await c.env.DB.prepare("DELETE FROM experiment_results WHERE experiment_id = ?")
    .bind(id)
    .run();

  const result = await c.env.DB.prepare(
    "DELETE FROM prompt_experiments WHERE id = ? RETURNING id",
  )
    .bind(id)
    .first();

  if (!result) return c.json({ error: "Experiment not found" }, 404);
  return c.json({ success: true });
});

/**
 * Get active experiment variant for an agent execution.
 * Called from playground before execution to determine which prompt to use.
 * Returns the variant ('a' or 'b') and the prompt, or null if no active experiment.
 */
export async function getExperimentVariant(
  db: D1Database,
  agentId: string,
): Promise<{ experimentId: number; variant: "a" | "b"; prompt: string } | null> {
  const experiment = await db
    .prepare(
      `SELECT id, variant_a_prompt, variant_b_prompt, traffic_split FROM prompt_experiments WHERE agent_id = ? AND status = '${EXPERIMENT_STATUS.RUNNING}' LIMIT 1`,
    )
    .bind(agentId)
    .first<{
      id: number;
      variant_a_prompt: string;
      variant_b_prompt: string;
      traffic_split: number;
    }>();

  if (!experiment) return null;

  const variant = Math.random() < experiment.traffic_split ? "a" : "b";
  const prompt = variant === "a" ? experiment.variant_a_prompt : experiment.variant_b_prompt;

  return { experimentId: experiment.id, variant, prompt };
}

/**
 * Record an experiment result after execution.
 */
export async function recordExperimentResult(
  db: D1Database,
  experimentId: number,
  variant: "a" | "b",
  usageLogId: string | null,
  auditLogId: string | null,
  responseTimeMs: number | null,
  inputTokens: number | null,
  outputTokens: number | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO experiment_results (experiment_id, variant, usage_log_id, audit_log_id, response_time_ms, input_tokens, output_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(experimentId, variant, usageLogId, auditLogId, responseTimeMs, inputTokens, outputTokens)
    .run();

  // Update running totals
  const col = variant === "a" ? "total_a" : "total_b";
  await db
    .prepare(`UPDATE prompt_experiments SET ${col} = ${col} + 1 WHERE id = ?`)
    .bind(experimentId)
    .run();
}

export default experiments;
