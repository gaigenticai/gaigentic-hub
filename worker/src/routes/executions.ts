import { Hono } from "hono";
import type { Env } from "../types";
import { getSessionUser } from "../session";

const executions = new Hono<{ Bindings: Env }>();

// GET /executions/:id — Retrieve raw execution result by audit log ID
executions.get("/:id", async (c) => {
  const id = c.req.param("id");

  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Authentication required" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const log = await c.env.DB.prepare(
    `SELECT id, agent_slug, input_text, output_text, llm_provider, llm_model, created_at
     FROM audit_logs WHERE id = ? AND user_id = ?`,
  )
    .bind(id, user.id)
    .first<{
      id: string;
      agent_slug: string;
      input_text: string;
      output_text: string | null;
      llm_provider: string;
      llm_model: string;
      created_at: string;
    }>();

  if (!log) return c.json({ error: "Execution not found" }, 404);

  return c.json({
    execution: {
      id: log.id,
      agent_slug: log.agent_slug,
      input: log.input_text,
      output: log.output_text,
      provider: log.llm_provider,
      model: log.llm_model,
      created_at: log.created_at,
    },
  });
});

// GET /executions — List recent executions for the current user
executions.get("/", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Authentication required" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = parseInt(c.req.query("offset") || "0");

  const results = await c.env.DB.prepare(
    `SELECT id, agent_slug, input_text, output_text, llm_provider, llm_model, created_at
     FROM audit_logs WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(user.id, limit, offset)
    .all<{
      id: string;
      agent_slug: string;
      input_text: string;
      output_text: string | null;
      llm_provider: string;
      llm_model: string;
      created_at: string;
    }>();

  return c.json({
    executions: results.results.map((log) => ({
      id: log.id,
      agent_slug: log.agent_slug,
      input: log.input_text,
      output: log.output_text,
      provider: log.llm_provider,
      model: log.llm_model,
      created_at: log.created_at,
    })),
  });
});

export default executions;
