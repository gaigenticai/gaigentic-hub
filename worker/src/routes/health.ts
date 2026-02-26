import { Hono } from "hono";
import type { Env } from "../types";

const health = new Hono<{ Bindings: Env }>();

// GET /health
health.get("/", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "gaigentic-hub-api",
    });
  } catch {
    return c.json({ status: "unhealthy" }, 500);
  }
});

// GET /health/agents
health.get("/agents", async (c) => {
  const agents = await c.env.DB.prepare(
    "SELECT slug, name, status FROM agents WHERE status != 'deprecated' ORDER BY sort_order ASC",
  ).all<{ slug: string; name: string; status: string }>();

  return c.json({
    agents: agents.results.map((a) => ({
      slug: a.slug,
      name: a.name,
      status: a.status,
    })),
  });
});

export default health;
