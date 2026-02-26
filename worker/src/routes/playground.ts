import { Hono } from "hono";
import type { Env, UserRow, AgentRow, LlmConfigRow } from "../types";
import { getSessionUser } from "../session";
import { checkRateLimit } from "../rateLimit";
import { createProvider, getDefaultProvider, getDefaultModel } from "../llm";
import { queryKnowledge } from "../rag";
import { decrypt } from "../encryption";
import { VISUAL_OUTPUT_INSTRUCTIONS } from "../visualEngine";
import {
  SANDBOX_MAX_CALLS,
  TRIAL_MAX_CALLS_PER_AGENT,
  PLAYGROUND_RATE_LIMIT,
  PLAYGROUND_RATE_WINDOW_MS,
} from "../constants";

const playground = new Hono<{ Bindings: Env }>();

/**
 * Hash a string to a short hex digest for audit trails.
 */
async function shortHash(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Wrap a ReadableStream to capture all text passing through it.
 * Returns the wrapped stream and a promise that resolves to the full text.
 */
function teeStreamCapture(stream: ReadableStream): {
  readable: ReadableStream;
  getText: () => Promise<string>;
} {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let captured = "";
  let resolveText: (text: string) => void;
  const textPromise = new Promise<string>((r) => {
    resolveText = r;
  });

  const readable = new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        resolveText(captured);
        controller.close();
        return;
      }
      const chunk = decoder.decode(value, { stream: true });
      captured += chunk;
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
      resolveText(captured);
    },
  });

  return { readable, getText: () => textPromise };
}

/**
 * Extract plain text content from captured SSE stream.
 */
function extractTextFromSSE(raw: string): string {
  const lines = raw.split("\n");
  let text = "";
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6);
    try {
      const parsed = JSON.parse(data);
      if (parsed.text) text += parsed.text;
    } catch {
      // skip
    }
  }
  return text;
}

// POST /playground/execute — SSE streaming agent execution
playground.post("/execute", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";

  // Rate limit
  const rl = await checkRateLimit(
    c.env.DB,
    `play:${ip}`,
    PLAYGROUND_RATE_LIMIT,
    PLAYGROUND_RATE_WINDOW_MS,
  );
  if (!rl.allowed) return c.json({ error: "Rate limit exceeded" }, 429);

  const body = await c.req.json<{
    agent_slug: string;
    input: Record<string, unknown>;
    provider?: string;
    model?: string;
    user_api_key?: string;
  }>();

  if (!body.agent_slug || !body.input) {
    return c.json({ error: "agent_slug and input are required" }, 400);
  }

  // Get agent
  const agent = await c.env.DB.prepare(
    "SELECT * FROM agents WHERE slug = ? AND status != 'deprecated'",
  )
    .bind(body.agent_slug)
    .first<AgentRow>();

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.status === "coming_soon") {
    return c.json({ error: "This agent is coming soon" }, 400);
  }

  // Auth check: authenticated user or sandbox
  const email = await getSessionUser(c);
  let userId: string | null = null;
  let isSandbox = false;

  if (email) {
    const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<UserRow>();
    userId = user?.id || null;

    // Check trial quota
    if (userId) {
      const usageCount = await c.env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id = ? AND agent_id = ?",
      )
        .bind(userId, agent.id)
        .first<{ cnt: number }>();

      if (usageCount && usageCount.cnt >= TRIAL_MAX_CALLS_PER_AGENT) {
        return c.json(
          { error: `Trial limit reached (${TRIAL_MAX_CALLS_PER_AGENT} calls per agent)` },
          429,
        );
      }
    }
  } else {
    // Sandbox mode
    isSandbox = true;
    const sandbox = await c.env.DB.prepare(
      "SELECT call_count FROM sandbox_usage WHERE ip_address = ?",
    )
      .bind(ip)
      .first<{ call_count: number }>();

    if (sandbox && sandbox.call_count >= SANDBOX_MAX_CALLS) {
      return c.json(
        {
          error: `Sandbox limit reached (${SANDBOX_MAX_CALLS} free calls). Sign up for a free trial!`,
          signup_required: true,
        },
        429,
      );
    }

    // Upsert sandbox usage
    await c.env.DB.prepare(
      `INSERT INTO sandbox_usage (ip_address, call_count, last_call_at)
       VALUES (?, 1, datetime('now'))
       ON CONFLICT(ip_address) DO UPDATE SET call_count = call_count + 1, last_call_at = datetime('now')`,
    )
      .bind(ip)
      .run();
  }

  // Resolve LLM provider
  let providerName = body.provider || c.env.DEFAULT_LLM_PROVIDER;
  let providerApiKey = body.user_api_key || "";
  let model = body.model || getDefaultModel(providerName);
  let usingSharedKey = false;

  if (!providerApiKey && userId) {
    // Check user's saved config
    const config = await c.env.DB.prepare(
      "SELECT * FROM llm_configs WHERE user_id = ? AND (provider = ? OR is_default = 1) ORDER BY CASE WHEN provider = ? THEN 0 ELSE 1 END LIMIT 1",
    )
      .bind(userId, providerName, providerName)
      .first<LlmConfigRow>();

    if (config) {
      providerApiKey = await decrypt(config.api_key_encrypted, c.env.ENCRYPTION_KEY);
      providerName = config.provider;
    }
  }

  const provider = providerApiKey
    ? createProvider(providerName, providerApiKey, c.env)
    : getDefaultProvider(c.env);

  if (!providerApiKey) {
    usingSharedKey = true;
    providerName = "zai";
    model = c.env.DEFAULT_LLM_MODEL;
  }

  // Build RAG context
  let ragContext = "";
  let ragSources: Array<{ source_name: string; source_type: string; score: number }> = [];
  try {
    const ragResults = await queryKnowledge(c.env, {
      query: JSON.stringify(body.input),
      agentId: agent.id,
      topK: 5,
    });

    if (ragResults.length > 0) {
      ragSources = ragResults.map((r) => ({
        source_name: r.source_name,
        source_type: r.source_type,
        score: r.score,
      }));
      ragContext =
        "\n\n=== RELEVANT KNOWLEDGE BASE ===\n" +
        ragResults
          .map(
            (r) => `Source: ${r.source_name} (${r.source_type})\n${r.content}`,
          )
          .join("\n---\n") +
        "\n=== END KNOWLEDGE BASE ===\n";
    }
  } catch {
    // RAG is optional — continue without it
  }

  // Build messages
  const systemPrompt =
    agent.system_prompt + ragContext + "\n\n" + VISUAL_OUTPUT_INSTRUCTIONS;

  const inputText = JSON.stringify(body.input, null, 2);
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: inputText },
  ];

  // Parse guardrails
  let maxTokens = 2048;
  let temperature = 0.7;
  if (agent.guardrails) {
    try {
      const guardrails = JSON.parse(agent.guardrails);
      maxTokens = guardrails.max_tokens || maxTokens;
      temperature = guardrails.temperature ?? temperature;
    } catch {
      // ignore
    }
  }

  const startTime = Date.now();
  const promptHash = await shortHash(systemPrompt);

  // Pre-generate audit log ID so we can return it in headers
  const auditLogId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  // Stream response
  try {
    const stream = await provider.stream({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    // Tee the stream to capture output for audit
    const { readable, getText } = teeStreamCapture(stream);

    // Log usage + audit (async, don't block response)
    c.executionCtx.waitUntil(
      (async () => {
        // Insert usage log first to get ID
        const usageResult = await c.env.DB.prepare(
          `INSERT INTO usage_logs (user_id, agent_id, agent_slug, llm_provider, llm_model, is_sandbox, status)
           VALUES (?, ?, ?, ?, ?, ?, 'success')
           RETURNING id`,
        )
          .bind(userId, agent.id, agent.slug, providerName, model, isSandbox ? 1 : 0)
          .first<{ id: string }>();

        // Wait for stream to complete, then insert audit log
        const rawSSE = await getText();
        const outputText = extractTextFromSSE(rawSSE);

        await c.env.DB.prepare(
          `INSERT INTO audit_logs (id, usage_log_id, user_id, agent_id, agent_slug, input_text, output_text, rag_sources, system_prompt_hash, llm_provider, llm_model, temperature, max_tokens)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            auditLogId,
            usageResult?.id || null,
            userId,
            agent.id,
            agent.slug,
            inputText,
            outputText,
            ragSources.length > 0 ? JSON.stringify(ragSources) : null,
            promptHash,
            providerName,
            model,
            temperature,
            maxTokens,
          )
          .run();
      })(),
    );

    // Return SSE stream with audit log ID in header
    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Audit-Log-Id": auditLogId,
      "Access-Control-Expose-Headers": "X-Audit-Log-Id",
    };

    if (usingSharedKey) {
      headers["X-Using-Shared-Key"] = "true";
    }

    return new Response(readable, { headers });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "LLM execution failed";

    // Log error
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        `INSERT INTO usage_logs (user_id, agent_id, agent_slug, llm_provider, llm_model, response_time_ms, is_sandbox, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'error', ?)`,
      )
        .bind(
          userId,
          agent.id,
          agent.slug,
          providerName,
          model,
          Date.now() - startTime,
          isSandbox ? 1 : 0,
          errorMsg,
        )
        .run(),
    );

    return c.json({ error: errorMsg }, 500);
  }
});

export default playground;
