/**
 * Session token system — adapted from Chaosbird.
 * HMAC-SHA256 signed tokens with server-side secret.
 * Payload: { e: email, t: timestamp }
 * Expiry: 7 days (30-day refresh window).
 */

import type { Context } from "hono";
import type { Env } from "./types";

const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function toBase64Url(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(
  email: string,
  secret: string,
): Promise<string> {
  const payload = JSON.stringify({ e: email, t: Date.now() });
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadB64 = toBase64Url(payloadBytes.buffer as ArrayBuffer);
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return `${payloadB64}.${toBase64Url(sig)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const key = await getHmacKey(secret);
  const payloadBytes = fromBase64Url(token.slice(0, dot));
  const sigBytes = fromBase64Url(token.slice(dot + 1));

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (Date.now() - payload.t > SESSION_EXPIRY_MS) return null;
    return payload.e as string;
  } catch {
    return null;
  }
}

export async function verifySessionTokenAllowExpired(
  token: string,
  secret: string,
): Promise<string | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const key = await getHmacKey(secret);
  const payloadBytes = fromBase64Url(token.slice(0, dot));
  const sigBytes = fromBase64Url(token.slice(dot + 1));

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (Date.now() - payload.t > REFRESH_WINDOW_MS) return null;
    return payload.e as string;
  } catch {
    return null;
  }
}

export async function getSessionUser(
  c: Context<{ Bindings: Env }>,
): Promise<string | null> {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifySessionToken(authHeader.slice(7), c.env.SESSION_SECRET);
}
