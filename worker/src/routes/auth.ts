import { Hono } from "hono";
import bcrypt from "bcryptjs";
import type { Env, UserRow } from "../types";
import { createSessionToken, verifySessionTokenAllowExpired } from "../session";
import { createAdminToken } from "../adminAuth";
import { checkRateLimit } from "../rateLimit";
import { createChaosbirdAccount, generateChaosbirdUsername, sendLeadNotification, sendWelcomeMessage } from "../chaosbird";
import { AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS, TRIAL_DURATION_DAYS, isBlockedEmailDomain } from "../constants";

const auth = new Hono<{ Bindings: Env }>();

// POST /auth/signup
auth.post("/signup", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(c.env.DB, `auth:${ip}`, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS);
  if (!rl.allowed) return c.json({ error: "Too many requests" }, 429);

  const body = await c.req.json<{
    name?: string;
    email?: string;
    company_name?: string;
  }>();

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const companyName = body.company_name?.trim();

  if (!name || name.length < 2 || name.length > 100) {
    return c.json({ error: "Name must be 2-100 characters" }, 400);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: "Valid email required" }, 400);
  }
  const blockedDomain = isBlockedEmailDomain(email);
  if (blockedDomain) {
    return c.json(
      { error: `Please use your work email. ${blockedDomain} addresses are not accepted.` },
      400,
    );
  }
  if (!companyName || companyName.length < 2 || companyName.length > 100) {
    return c.json({ error: "Company name must be 2-100 characters" }, 400);
  }

  // Check email uniqueness
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  // Generate company slug
  const companySlug = generateChaosbirdUsername(companyName);

  // Create Chaosbird account
  const chaosbird = await createChaosbirdAccount(c.env.CHAOSBIRD_API_URL, companyName);

  // Insert user
  const user = await c.env.DB.prepare(
    `INSERT INTO users (name, email, company_name, company_slug, chaosbird_username, chaosbird_account_created, trial_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+' || ? || ' days'))
     RETURNING id, name, email, company_name, company_slug, chaosbird_username, role, trial_expires_at, created_at`,
  )
    .bind(name, email, companyName, companySlug, chaosbird.username, chaosbird.success ? 1 : 0, TRIAL_DURATION_DAYS)
    .first<UserRow>();

  if (!user) return c.json({ error: "Failed to create account" }, 500);

  const sessionToken = await createSessionToken(email, c.env.SESSION_SECRET);

  // Send lead notification to Krishna on Chaosbird (non-blocking)
  if (chaosbird.success && c.env.CHAOSBIRD_ADMIN_TOKEN) {
    c.executionCtx.waitUntil(
      sendLeadNotification(
        c.env.CHAOSBIRD_API_URL,
        c.env.CHAOSBIRD_ADMIN_TOKEN,
        c.env.CHAOSBIRD_ADMIN_USERNAME,
        { name: name!, email: email!, company: companyName!, chaosbirdUsername: chaosbird.username },
      ),
    );

    // Send welcome message to the new user's Chaosbird inbox (non-blocking)
    c.executionCtx.waitUntil(
      sendWelcomeMessage(
        c.env.CHAOSBIRD_API_URL,
        c.env.CHAOSBIRD_ADMIN_TOKEN,
        chaosbird.username,
        name!,
      ),
    );
  }

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
    session_token: sessionToken,
    chaosbird_username: chaosbird.username,
  });
});

// POST /auth/login
auth.post("/login", async (c) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const rl = await checkRateLimit(c.env.DB, `auth:${ip}`, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS);
  if (!rl.allowed) return c.json({ error: "Too many requests" }, 429);

  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email) return c.json({ error: "Email required" }, 400);

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();

  if (!user) return c.json({ error: "Account not found" }, 404);

  // If user has a password set, require it
  if (user.password_hash) {
    if (!password) return c.json({ error: "Password required" }, 401);
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return c.json({ error: "Invalid password" }, 401);
  }

  // Update last seen
  await c.env.DB.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();

  const sessionToken = await createSessionToken(email, c.env.SESSION_SECRET);

  // If admin, also generate admin token
  let adminToken: string | undefined;
  if (user.role === "admin" && user.password_hash) {
    adminToken = await createAdminToken(email, user.password_hash);
  }

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
    session_token: sessionToken,
    admin_token: adminToken,
  });
});

// POST /auth/refresh-session
auth.post("/refresh-session", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Token required" }, 401);
  }

  const token = authHeader.slice(7);
  const email = await verifySessionTokenAllowExpired(token, c.env.SESSION_SECRET);
  if (!email) return c.json({ error: "Token expired" }, 401);

  const newToken = await createSessionToken(email, c.env.SESSION_SECRET);
  return c.json({ session_token: newToken });
});

// POST /auth/set-password
auth.post("/set-password", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const token = authHeader.slice(7);
  const email = await verifySessionTokenAllowExpired(token, c.env.SESSION_SECRET);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{ password?: string }>();
  const password = body.password;

  if (!password || password.length < 8 || password.length > 72) {
    return c.json({ error: "Password must be 8-72 characters" }, 400);
  }

  const hash = await bcrypt.hash(password, 12);
  await c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE email = ?")
    .bind(hash, email)
    .run();

  return c.json({ success: true });
});

export default auth;
