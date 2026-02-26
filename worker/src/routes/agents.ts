import { Hono } from "hono";
import type { Env, AgentRow } from "../types";

const agents = new Hono<{ Bindings: Env }>();

// GET /agents — List all active agents (public)
agents.get("/", async (c) => {
  const category = c.req.query("category");

  let query = "SELECT id, slug, name, tagline, description, category, icon, color, version, status, sample_input, sample_output, created_at FROM agents WHERE status != 'deprecated'";
  const binds: string[] = [];

  if (category) {
    query += " AND category = ?";
    binds.push(category);
  }

  query += " ORDER BY sort_order ASC, name ASC";

  const stmt = binds.length
    ? c.env.DB.prepare(query).bind(...binds)
    : c.env.DB.prepare(query);

  const result = await stmt.all<AgentRow>();
  return c.json({ agents: result.results });
});

// GET /agents/:slug — Single agent detail (public)
agents.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const agent = await c.env.DB.prepare(
    "SELECT id, slug, name, tagline, description, category, icon, color, version, status, sample_input, sample_output, created_at FROM agents WHERE slug = ?",
  )
    .bind(slug)
    .first<AgentRow>();

  if (!agent) return c.json({ error: "Agent not found" }, 404);

  return c.json({ agent });
});

export default agents;
