/**
 * Webhook management routes — authenticated users.
 * CRUD for webhooks + trigger utility for execution events.
 */

import { Hono } from "hono";
import type { Env } from "../types";
import { getSessionUser } from "../session";

const webhooks = new Hono<{ Bindings: Env }>();

// Auth middleware
webhooks.use("*", async (c, next) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);
  c.set("userEmail" as never, email as never);
  await next();
});

async function getUserId(db: D1Database, email: string): Promise<string | null> {
  const user = await db.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  return user?.id || null;
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// POST /webhooks — create webhook
webhooks.post("/", async (c) => {
  const email = c.get("userEmail" as never) as string;
  const userId = await getUserId(c.env.DB, email);
  if (!userId) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{ url: string; events?: string[] }>();
  if (!body.url) return c.json({ error: "url is required" }, 400);

  try {
    new URL(body.url);
  } catch {
    return c.json({ error: "Invalid URL" }, 400);
  }

  if (!body.url.startsWith("https://")) {
    return c.json({ error: "Webhook URL must use HTTPS" }, 400);
  }

  const events = body.events || ["execution.complete", "execution.error"];
  const validEvents = ["execution.complete", "execution.error", "feedback.received", "experiment.result"];
  for (const e of events) {
    if (!validEvents.includes(e)) {
      return c.json({ error: `Invalid event: ${e}. Valid: ${validEvents.join(", ")}` }, 400);
    }
  }

  const secret = generateSecret();

  const result = await c.env.DB.prepare(
    `INSERT INTO webhooks (user_id, url, events, secret)
     VALUES (?, ?, ?, ?) RETURNING id`,
  )
    .bind(userId, body.url, JSON.stringify(events), secret)
    .first<{ id: number }>();

  return c.json({
    webhook: {
      id: result?.id,
      url: body.url,
      events,
      secret,
      active: true,
    },
    note: "Save the secret — it won't be shown again. Use it to verify webhook signatures.",
  }, 201);
});

// GET /webhooks — list user's webhooks
webhooks.get("/", async (c) => {
  const email = c.get("userEmail" as never) as string;
  const userId = await getUserId(c.env.DB, email);
  if (!userId) return c.json({ error: "User not found" }, 404);

  const result = await c.env.DB.prepare(
    `SELECT id, url, events, active, failure_count, last_triggered_at, created_at
     FROM webhooks WHERE user_id = ? ORDER BY created_at DESC`,
  )
    .bind(userId)
    .all();

  const hooks = result.results.map((w: Record<string, unknown>) => ({
    ...w,
    events: JSON.parse(w.events as string),
  }));

  return c.json({ webhooks: hooks });
});

// PUT /webhooks/:id — update webhook
webhooks.put("/:id", async (c) => {
  const email = c.get("userEmail" as never) as string;
  const userId = await getUserId(c.env.DB, email);
  if (!userId) return c.json({ error: "User not found" }, 404);

  const id = c.req.param("id");
  const body = await c.req.json<{ url?: string; events?: string[]; active?: boolean }>();

  const existing = await c.env.DB.prepare(
    "SELECT id FROM webhooks WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first();

  if (!existing) return c.json({ error: "Webhook not found" }, 404);

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.url !== undefined) {
    if (!body.url.startsWith("https://")) {
      return c.json({ error: "Webhook URL must use HTTPS" }, 400);
    }
    updates.push("url = ?");
    values.push(body.url);
  }
  if (body.events !== undefined) {
    updates.push("events = ?");
    values.push(JSON.stringify(body.events));
  }
  if (body.active !== undefined) {
    updates.push("active = ?");
    values.push(body.active ? 1 : 0);
  }

  if (updates.length === 0) return c.json({ error: "Nothing to update" }, 400);

  values.push(parseInt(id));
  await c.env.DB.prepare(`UPDATE webhooks SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true });
});

// DELETE /webhooks/:id — delete webhook
webhooks.delete("/:id", async (c) => {
  const email = c.get("userEmail" as never) as string;
  const userId = await getUserId(c.env.DB, email);
  if (!userId) return c.json({ error: "User not found" }, 404);

  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    "DELETE FROM webhooks WHERE id = ? AND user_id = ? RETURNING id",
  )
    .bind(id, userId)
    .first();

  if (!result) return c.json({ error: "Webhook not found" }, 404);
  return c.json({ success: true });
});

// POST /webhooks/:id/test — send test payload
webhooks.post("/:id/test", async (c) => {
  const email = c.get("userEmail" as never) as string;
  const userId = await getUserId(c.env.DB, email);
  if (!userId) return c.json({ error: "User not found" }, 404);

  const id = c.req.param("id");
  const hook = await c.env.DB.prepare(
    "SELECT url, secret FROM webhooks WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ url: string; secret: string }>();

  if (!hook) return c.json({ error: "Webhook not found" }, 404);

  const payload = {
    event: "test",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook from GaiGentic Hub",
      agent: "test-agent",
      status: "success",
    },
  };

  try {
    const signature = await signPayload(JSON.stringify(payload), hook.secret);
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GaiGentic-Signature": signature,
        "X-GaiGentic-Event": "test",
      },
      body: JSON.stringify(payload),
    });

    return c.json({
      success: res.ok,
      status: res.status,
      statusText: res.statusText,
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message });
  }
});

// Utility: sign payload with HMAC-SHA256
async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Trigger webhooks for an event. Call from playground after execution.
 * Non-blocking — fires and forgets.
 */
export async function triggerWebhooks(
  db: D1Database,
  userId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  const hooks = await db
    .prepare(
      "SELECT id, url, secret FROM webhooks WHERE user_id = ? AND active = 1 AND failure_count < 5",
    )
    .bind(userId)
    .all<{ id: number; url: string; secret: string }>();

  for (const hook of hooks.results) {
    const events: string[] = JSON.parse(
      (
        await db
          .prepare("SELECT events FROM webhooks WHERE id = ?")
          .bind(hook.id)
          .first<{ events: string }>()
      )?.events || "[]",
    );

    if (!events.includes(event)) continue;

    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    try {
      const signature = await signPayload(payload, hook.secret);
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GaiGentic-Signature": signature,
          "X-GaiGentic-Event": event,
        },
        body: payload,
      });

      if (res.ok) {
        await db
          .prepare("UPDATE webhooks SET last_triggered_at = datetime('now'), failure_count = 0 WHERE id = ?")
          .bind(hook.id)
          .run();
      } else {
        await db
          .prepare("UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?")
          .bind(hook.id)
          .run();
      }
    } catch {
      await db
        .prepare("UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?")
        .bind(hook.id)
        .run();
    }
  }
}

export default webhooks;
