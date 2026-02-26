import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";

// Route imports
import authRoutes from "./routes/auth";
import agentRoutes from "./routes/agents";
import playgroundRoutes from "./routes/playground";
import apikeyRoutes from "./routes/apikeys";
import adminRoutes from "./routes/admin";
import ragRoutes from "./routes/rag";
import usageRoutes from "./routes/usage";
import healthRoutes from "./routes/health";
import feedbackRoutes from "./routes/feedback";
import documentRoutes from "./routes/documents";

// External API imports
import { hashApiKey } from "./routes/apikeys";
import { createProvider, getDefaultModel } from "./llm";
import { queryKnowledge } from "./rag";
import { VISUAL_OUTPUT_INSTRUCTIONS } from "./visualEngine";
import { checkRateLimit } from "./rateLimit";
import { sendChaosbirdMessage } from "./chaosbird";
import { API_RATE_LIMIT, API_RATE_WINDOW_MS, EXPIRY_WARNING_DAYS } from "./constants";

const app = new Hono<{ Bindings: Env }>();

// ==========================================
// Middleware
// ==========================================

app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3001",
      "https://hub.gaigentic.ai",
      "https://gaigentic-hub.pages.dev",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["X-Audit-Log-Id", "X-Using-Shared-Key"],
    maxAge: 86400,
  }),
);

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.delete("X-Powered-By");
  c.header("Server", "GaiGentic Hub");
});

// ==========================================
// Routes
// ==========================================

app.route("/auth", authRoutes);
app.route("/agents", agentRoutes);
app.route("/playground", playgroundRoutes);
app.route("/apikeys", apikeyRoutes);
app.route("/admin", adminRoutes);
app.route("/rag", ragRoutes);
app.route("/usage", usageRoutes);
app.route("/feedback", feedbackRoutes);
app.route("/health", healthRoutes);
app.route("/documents", documentRoutes);

// ==========================================
// Chat proxy: send message to Krishna via Chaosbird
// ==========================================

app.post("/chat/send", async (c) => {
  const body = await c.req.json<{ username?: string; message?: string }>();
  if (!body.username || !body.message) {
    return c.json({ error: "username and message required" }, 400);
  }
  if (!c.env.CHAOSBIRD_ADMIN_TOKEN) {
    return c.json({ error: "Chat not configured" }, 500);
  }

  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(c.env.DB, `chat:${ip}`, 5, 60000);
  if (!rl.allowed) return c.json({ error: "Too many messages, try again later" }, 429);

  const sent = await sendChaosbirdMessage(
    c.env.CHAOSBIRD_API_URL,
    c.env.CHAOSBIRD_ADMIN_TOKEN,
    c.env.CHAOSBIRD_ADMIN_USERNAME,
    `[${body.username}] ${body.message}`,
  );

  return c.json({ success: sent });
});

// ==========================================
// External API: /v1/agents/:slug/run
// Authenticated by API key (ghk_*)
// ==========================================

app.post("/v1/agents/:slug/run", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";

  // Rate limit
  const rl = await checkRateLimit(c.env.DB, `api:${ip}`, API_RATE_LIMIT, API_RATE_WINDOW_MS);
  if (!rl.allowed) return c.json({ error: "Rate limit exceeded" }, 429);

  // Validate API key
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ghk_")) {
    return c.json({ error: "API key required (Bearer ghk_...)" }, 401);
  }

  const apiKey = authHeader.slice(7);
  const keyHash = await hashApiKey(apiKey);

  const keyRow = await c.env.DB.prepare(
    "SELECT id, user_id, agent_id, expires_at, revoked FROM api_keys WHERE key_hash = ?",
  )
    .bind(keyHash)
    .first<{
      id: string;
      user_id: string;
      agent_id: string | null;
      expires_at: string;
      revoked: number;
    }>();

  if (!keyRow) return c.json({ error: "Invalid API key" }, 401);
  if (keyRow.revoked) return c.json({ error: "API key revoked" }, 401);
  if (new Date(keyRow.expires_at) < new Date()) {
    return c.json({ error: "API key expired" }, 401);
  }

  const slug = c.req.param("slug");

  // If key is scoped to an agent, validate
  if (keyRow.agent_id) {
    const agent = await c.env.DB.prepare("SELECT id FROM agents WHERE slug = ?")
      .bind(slug)
      .first<{ id: string }>();
    if (!agent || agent.id !== keyRow.agent_id) {
      return c.json({ error: "API key not authorized for this agent" }, 403);
    }
  }

  // Get agent
  const agent = await c.env.DB.prepare(
    "SELECT * FROM agents WHERE slug = ? AND status = 'active'",
  )
    .bind(slug)
    .first<{
      id: string;
      slug: string;
      system_prompt: string;
      guardrails: string | null;
    }>();

  if (!agent) return c.json({ error: "Agent not found or inactive" }, 404);

  const body = await c.req.json<{
    input: Record<string, unknown>;
    provider?: string;
    model?: string;
    user_api_key?: string;
  }>();

  if (!body.input) return c.json({ error: "input is required" }, 400);

  // Update last_used_at
  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?",
    )
      .bind(keyRow.id)
      .run(),
  );

  // Resolve provider
  const providerName = body.provider || "zai";
  const providerApiKey = body.user_api_key || c.env.ZAI_API_KEY;
  const model = body.model || getDefaultModel(providerName);
  const provider = createProvider(providerName, providerApiKey, c.env);

  // RAG context
  let ragContext = "";
  try {
    const ragResults = await queryKnowledge(c.env, {
      query: JSON.stringify(body.input),
      agentId: agent.id,
      topK: 5,
    });
    if (ragResults.length > 0) {
      ragContext =
        "\n\n=== RELEVANT KNOWLEDGE BASE ===\n" +
        ragResults
          .map((r) => `Source: ${r.source_name}\n${r.content}`)
          .join("\n---\n") +
        "\n=== END KNOWLEDGE BASE ===\n";
    }
  } catch {
    // Continue without RAG
  }

  const systemPrompt =
    agent.system_prompt + ragContext + "\n\n" + VISUAL_OUTPUT_INSTRUCTIONS;

  const inputText = JSON.stringify(body.input, null, 2);

  // Hash system prompt for audit trail
  const promptData = new TextEncoder().encode(systemPrompt);
  const promptHashBuf = await crypto.subtle.digest("SHA-256", promptData);
  const promptHash = Array.from(new Uint8Array(promptHashBuf).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  try {
    const result = await provider.chat({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: inputText },
      ],
      max_tokens: 2048,
    });

    // Log usage + audit
    c.executionCtx.waitUntil(
      (async () => {
        const usageResult = await c.env.DB.prepare(
          `INSERT INTO usage_logs (user_id, agent_id, agent_slug, api_key_id, input_tokens, output_tokens, llm_provider, llm_model, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success')
           RETURNING id`,
        )
          .bind(
            keyRow.user_id,
            agent.id,
            agent.slug,
            keyRow.id,
            result.usage.input_tokens,
            result.usage.output_tokens,
            result.provider,
            result.model,
          )
          .first<{ id: string }>();

        await c.env.DB.prepare(
          `INSERT INTO audit_logs (usage_log_id, user_id, agent_id, agent_slug, input_text, output_text, rag_sources, system_prompt_hash, llm_provider, llm_model, temperature, max_tokens)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            usageResult?.id || null,
            keyRow.user_id,
            agent.id,
            agent.slug,
            inputText,
            result.content,
            ragContext ? JSON.stringify(ragContext) : null,
            promptHash,
            result.provider,
            result.model,
            0.7,
            2048,
          )
          .run();
      })(),
    );

    return c.json({
      output: result.content,
      usage: result.usage,
      model: result.model,
      provider: result.provider,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Execution failed";
    return c.json({ error: errorMsg }, 500);
  }
});

// ==========================================
// LLM config
// ==========================================

app.put("/settings/llm-config", async (c) => {
  const { getSessionUser } = await import("./session");
  const { encrypt } = await import("./encryption");

  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{
    provider: string;
    api_key: string;
    is_default: boolean;
  }>();

  if (!body.provider || !body.api_key) {
    return c.json({ error: "provider and api_key are required" }, 400);
  }

  const validProviders = ["zai", "openai", "anthropic"];
  if (!validProviders.includes(body.provider)) {
    return c.json({ error: "Invalid provider" }, 400);
  }

  const encrypted = await encrypt(body.api_key, c.env.ENCRYPTION_KEY);

  // If setting as default, clear other defaults
  if (body.is_default) {
    await c.env.DB.prepare(
      "UPDATE llm_configs SET is_default = 0 WHERE user_id = ?",
    )
      .bind(user.id)
      .run();
  }

  await c.env.DB.prepare(
    `INSERT INTO llm_configs (user_id, provider, api_key_encrypted, is_default)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET api_key_encrypted = ?, is_default = ?`,
  )
    .bind(
      user.id,
      body.provider,
      encrypted,
      body.is_default ? 1 : 0,
      encrypted,
      body.is_default ? 1 : 0,
    )
    .run();

  return c.json({ success: true });
});

// ==========================================
// Cron Handler
// ==========================================

async function handleScheduled(env: Env): Promise<void> {
  const DB = env.DB;

  // 1. Send expiry warnings (3 days before)
  const expiringKeys = await DB.prepare(
    `SELECT ak.id, ak.user_id, u.chaosbird_username
     FROM api_keys ak JOIN users u ON ak.user_id = u.id
     WHERE ak.revoked = 0
       AND ak.notified_expiry = 0
       AND ak.expires_at BETWEEN datetime('now') AND datetime('now', '+${EXPIRY_WARNING_DAYS} days')`,
  ).all<{
    id: string;
    user_id: string;
    chaosbird_username: string | null;
  }>();

  for (const key of expiringKeys.results) {
    if (key.chaosbird_username) {
      await sendChaosbirdMessage(
        env.CHAOSBIRD_API_URL,
        env.CHAOSBIRD_ADMIN_TOKEN,
        key.chaosbird_username,
        `Your gaigentic Agent Hub API key expires in ${EXPIRY_WARNING_DAYS} days. Visit hub.gaigentic.ai/dashboard to generate a new key. Contact us here if you'd like to discuss an enterprise plan!`,
      );
    }

    await DB.prepare(
      "UPDATE api_keys SET notified_expiry = 1 WHERE id = ?",
    )
      .bind(key.id)
      .run();
  }

  // 2. Clean expired response cache
  await DB.prepare("DELETE FROM response_cache WHERE expires_at < datetime('now')").run();

  // 3. Clean old rate limit entries (older than 1 hour)
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  await DB.prepare("DELETE FROM rate_limits WHERE window_start < ?")
    .bind(oneHourAgo)
    .run();

  // 4. Reset old sandbox entries (older than 24 hours)
  await DB.prepare(
    "DELETE FROM sandbox_usage WHERE last_call_at < datetime('now', '-1 day')",
  ).run();
}

// ==========================================
// Export
// ==========================================

export default {
  fetch: app.fetch,
  scheduled: async (
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ) => {
    await handleScheduled(env);
  },
};
