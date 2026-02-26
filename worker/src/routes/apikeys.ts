import { Hono } from "hono";
import type { Env, UserRow, ApiKeyRow } from "../types";
import { getSessionUser } from "../session";
import { API_KEY_EXPIRY_DAYS } from "../constants";

const apikeys = new Hono<{ Bindings: Env }>();

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function generateApiKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const key = `ghk_${hex}`;
  const prefix = `ghk_${hex.slice(0, 8)}`;
  const hash = await hashApiKey(key);
  return { key, prefix, hash };
}

// POST /apikeys/generate
apikeys.post("/generate", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{ agent_id?: string }>().catch(() => ({ agent_id: undefined }));

  // Check if user already has an active key — allow max 3
  const activeKeys = await c.env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM api_keys WHERE user_id = ? AND revoked = 0 AND expires_at > datetime('now')",
  )
    .bind(user.id)
    .first<{ cnt: number }>();

  if (activeKeys && activeKeys.cnt >= 3) {
    return c.json({ error: "Maximum 3 active API keys. Revoke one first." }, 400);
  }

  const { key, prefix, hash } = await generateApiKey();
  const expiresAt = new Date(
    Date.now() + API_KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await c.env.DB.prepare(
    "INSERT INTO api_keys (user_id, key_prefix, key_hash, agent_id, expires_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(user.id, prefix, hash, body.agent_id || null, expiresAt)
    .run();

  return c.json({ key, prefix, expires_at: expiresAt });
});

// GET /apikeys/mine
apikeys.get("/mine", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const result = await c.env.DB.prepare(
    "SELECT id, key_prefix, agent_id, expires_at, last_used_at, revoked, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(user.id)
    .all<ApiKeyRow>();

  return c.json({ keys: result.results });
});

// DELETE /apikeys/:id
apikeys.delete("/:id", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const keyId = c.req.param("id");
  await c.env.DB.prepare(
    "UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(keyId, user.id)
    .run();

  return c.json({ success: true });
});

// Export hashApiKey for use in playground/external API validation
export { hashApiKey };
export default apikeys;
