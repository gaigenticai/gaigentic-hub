import { Hono } from "hono";
import type { Env, AgentRow } from "../types";

const AGENT_FIELDS = "id, slug, name, tagline, description, category, icon, color, version, status, sample_input, sample_output, capabilities, jurisdictions, playground_instructions, featured, created_at";

const agents = new Hono<{ Bindings: Env }>();

// GET /agents — List all active agents (public)
agents.get("/", async (c) => {
  const category = c.req.query("category");

  let query = `SELECT ${AGENT_FIELDS} FROM agents WHERE status != 'deprecated'`;
  const binds: string[] = [];

  if (category) {
    query += " AND category = ?";
    binds.push(category);
  }

  query += " ORDER BY featured DESC, sort_order ASC, name ASC";

  const stmt = binds.length
    ? c.env.DB.prepare(query).bind(...binds)
    : c.env.DB.prepare(query);

  const result = await stmt.all<AgentRow>();
  return c.json({ agents: result.results });
});

// GET /agents/featured — Get featured agents (public)
agents.get("/featured", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT ${AGENT_FIELDS} FROM agents WHERE featured = 1 AND status = 'active' ORDER BY sort_order ASC LIMIT 5`,
  ).all<AgentRow>();

  return c.json({ agents: result.results });
});

// GET /agents/search — AI-powered search (public)
agents.get("/search", async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q || q.length < 2) {
    return c.json({ agents: [] });
  }

  // Text-based search (fast, no embeddings needed for now)
  const searchTerm = `%${q}%`;
  const result = await c.env.DB.prepare(
    `SELECT ${AGENT_FIELDS} FROM agents
     WHERE status != 'deprecated'
       AND (name LIKE ? OR tagline LIKE ? OR description LIKE ? OR category LIKE ? OR capabilities LIKE ? OR jurisdictions LIKE ?)
     ORDER BY featured DESC, sort_order ASC
     LIMIT 20`,
  )
    .bind(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm)
    .all<AgentRow>();

  return c.json({ agents: result.results });
});

// GET /agents/:slug — Single agent detail (public)
agents.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const agent = await c.env.DB.prepare(
    `SELECT ${AGENT_FIELDS} FROM agents WHERE slug = ?`,
  )
    .bind(slug)
    .first<AgentRow>();

  if (!agent) return c.json({ error: "Agent not found" }, 404);

  return c.json({ agent });
});

export default agents;
