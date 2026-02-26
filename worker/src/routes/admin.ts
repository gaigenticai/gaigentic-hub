import { Hono } from "hono";
import type { Env, UserRow, AgentRow } from "../types";
import { isAdmin } from "../adminAuth";
import { checkRateLimit } from "../rateLimit";
import { sendChaosbirdMessage } from "../chaosbird";

const admin = new Hono<{ Bindings: Env }>();

// Admin middleware
admin.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(c.env.DB, `admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return c.json({ error: "Too many requests" }, 429);

  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

// GET /admin/stats
admin.get("/stats", async (c) => {
  const results = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) as cnt FROM users"),
    c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM users WHERE created_at >= date('now')",
    ),
    c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM users WHERE created_at >= date('now', '-7 days')",
    ),
    c.env.DB.prepare("SELECT COUNT(*) as cnt FROM usage_logs"),
    c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM usage_logs WHERE created_at >= date('now')",
    ),
    c.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM api_keys WHERE revoked = 0 AND expires_at > datetime('now')",
    ),
    c.env.DB.prepare(
      `SELECT a.slug, a.name, COUNT(u.id) as calls
       FROM usage_logs u JOIN agents a ON u.agent_id = a.id
       GROUP BY a.slug, a.name ORDER BY calls DESC LIMIT 10`,
    ),
    c.env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as count
       FROM users WHERE created_at >= date('now', '-7 days')
       GROUP BY date(created_at) ORDER BY date ASC`,
    ),
  ]);

  return c.json({
    total_signups: (results[0].results[0] as { cnt: number })?.cnt || 0,
    signups_today: (results[1].results[0] as { cnt: number })?.cnt || 0,
    signups_this_week: (results[2].results[0] as { cnt: number })?.cnt || 0,
    total_api_calls: (results[3].results[0] as { cnt: number })?.cnt || 0,
    calls_today: (results[4].results[0] as { cnt: number })?.cnt || 0,
    active_api_keys: (results[5].results[0] as { cnt: number })?.cnt || 0,
    agent_usage: results[6].results,
    daily_signups: results[7].results,
  });
});

// GET /admin/signups
admin.get("/signups", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const search = c.req.query("search") || "";
  const offset = (page - 1) * limit;

  let countQuery = "SELECT COUNT(*) as total FROM users";
  let dataQuery = `SELECT u.id, u.name, u.email, u.company_name, u.company_slug, u.chaosbird_username, u.created_at,
    (SELECT COUNT(*) FROM usage_logs WHERE user_id = u.id) as api_calls,
    (SELECT MAX(created_at) FROM usage_logs WHERE user_id = u.id) as last_active
    FROM users u`;

  const binds: string[] = [];

  if (search) {
    const where = " WHERE u.name LIKE ? OR u.email LIKE ? OR u.company_name LIKE ?";
    countQuery += where.replace(/u\./g, "");
    dataQuery += where;
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  dataQuery += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";

  const countStmt = binds.length
    ? c.env.DB.prepare(countQuery).bind(...binds)
    : c.env.DB.prepare(countQuery);

  const dataStmt = c.env.DB.prepare(dataQuery).bind(
    ...binds,
    limit,
    offset,
  );

  const [countResult, dataResult] = await Promise.all([
    countStmt.first<{ total: number }>(),
    dataStmt.all(),
  ]);

  return c.json({
    signups: dataResult.results,
    total: countResult?.total || 0,
  });
});

// GET /admin/signup/:id
admin.get("/signup/:id", async (c) => {
  const id = c.req.param("id");

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<UserRow>();

  if (!user) return c.json({ error: "User not found" }, 404);

  const usage = await c.env.DB.prepare(
    `SELECT agent_slug, COUNT(*) as count, MAX(created_at) as last_used
     FROM usage_logs WHERE user_id = ?
     GROUP BY agent_slug ORDER BY count DESC`,
  )
    .bind(id)
    .all();

  const keys = await c.env.DB.prepare(
    "SELECT id, key_prefix, expires_at, last_used_at, revoked, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(id)
    .all();

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      company_name: user.company_name,
      company_slug: user.company_slug,
      chaosbird_username: user.chaosbird_username,
      role: user.role,
      trial_expires_at: user.trial_expires_at,
      created_at: user.created_at,
    },
    usage: usage.results,
    api_keys: keys.results,
  });
});

// POST /admin/contact — Send Chaosbird message to user
admin.post("/contact", async (c) => {
  const body = await c.req.json<{ user_id: string; message: string }>();

  if (!body.user_id || !body.message) {
    return c.json({ error: "user_id and message are required" }, 400);
  }

  const user = await c.env.DB.prepare(
    "SELECT chaosbird_username FROM users WHERE id = ?",
  )
    .bind(body.user_id)
    .first<{ chaosbird_username: string | null }>();

  if (!user?.chaosbird_username) {
    return c.json({ error: "User has no Chaosbird account" }, 400);
  }

  const sent = await sendChaosbirdMessage(
    c.env.CHAOSBIRD_API_URL,
    c.env.CHAOSBIRD_ADMIN_TOKEN,
    user.chaosbird_username,
    body.message,
  );

  return c.json({ success: sent });
});

// POST /admin/extend-trial — Extend user's trial + API key expiry
admin.post("/extend-trial", async (c) => {
  const body = await c.req.json<{ user_id: string; days: number }>();

  if (!body.user_id || !body.days || body.days < 1 || body.days > 90) {
    return c.json({ error: "user_id and days (1-90) required" }, 400);
  }

  // Extend API key expiry
  await c.env.DB.prepare(
    `UPDATE api_keys SET expires_at = datetime(expires_at, '+' || ? || ' days')
     WHERE user_id = ? AND revoked = 0`,
  )
    .bind(body.days, body.user_id)
    .run();

  // Extend trial expiry (start from now if already expired)
  await c.env.DB.prepare(
    `UPDATE users SET trial_expires_at = datetime(
       CASE WHEN trial_expires_at > datetime('now') THEN trial_expires_at ELSE datetime('now') END,
       '+' || ? || ' days'
     ) WHERE id = ?`,
  )
    .bind(body.days, body.user_id)
    .run();

  return c.json({ success: true });
});

// POST /admin/agents — Create agent
admin.post("/agents", async (c) => {
  const body = await c.req.json<{
    slug: string;
    name: string;
    tagline: string;
    description: string;
    category: string;
    icon: string;
    color: string;
    status?: string;
    sample_input: string;
    sample_output: string;
    system_prompt: string;
    guardrails?: string;
    capabilities?: string;
    jurisdictions?: string;
    featured?: number;
    sort_order?: number;
  }>();

  if (!body.slug || !body.name || !body.system_prompt) {
    return c.json({ error: "slug, name, and system_prompt are required" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO agents (slug, name, tagline, description, category, icon, color, status, sample_input, sample_output, system_prompt, guardrails, capabilities, jurisdictions, featured, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      body.slug,
      body.name,
      body.tagline,
      body.description,
      body.category,
      body.icon,
      body.color,
      body.status || "active",
      body.sample_input,
      body.sample_output,
      body.system_prompt,
      body.guardrails || null,
      body.capabilities || null,
      body.jurisdictions || null,
      body.featured || 0,
      body.sort_order || 0,
    )
    .run();

  return c.json({ success: true });
});

// PUT /admin/agents/:slug — Update agent
admin.put("/agents/:slug", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<Partial<AgentRow>>();

  const fields: string[] = [];
  const values: unknown[] = [];

  const allowed = [
    "name",
    "tagline",
    "description",
    "category",
    "icon",
    "color",
    "status",
    "sample_input",
    "sample_output",
    "system_prompt",
    "guardrails",
    "capabilities",
    "jurisdictions",
    "featured",
    "sort_order",
  ];

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push((body as Record<string, unknown>)[key]);
    }
  }

  if (fields.length === 0) return c.json({ error: "No fields to update" }, 400);

  fields.push("updated_at = datetime('now')");
  values.push(slug);

  await c.env.DB.prepare(
    `UPDATE agents SET ${fields.join(", ")} WHERE slug = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ success: true });
});

export default admin;
