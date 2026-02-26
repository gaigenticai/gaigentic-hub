/**
 * Admin authentication — adapted from Chaosbird.
 * Admin token uses ADMIN_PASSWORD_HASH as HMAC key.
 */

import type { Context } from "hono";
import type { Env } from "./types";

const ADMIN_TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

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

export async function createAdminToken(
  email: string,
  passwordHash: string,
): Promise<string> {
  const payload = JSON.stringify({ e: email, t: Date.now() });
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadB64 = toBase64Url(payloadBytes.buffer as ArrayBuffer);
  const key = await getHmacKey(passwordHash);
  const sig = await crypto.subtle.sign("HMAC", key, payloadBytes);
  return `${payloadB64}.${toBase64Url(sig)}`;
}

export async function verifyAdminToken(
  token: string,
  passwordHash: string,
  expectedEmail: string,
): Promise<boolean> {
  const dot = token.indexOf(".");
  if (dot === -1) return false;

  const key = await getHmacKey(passwordHash);
  const payloadBytes = fromBase64Url(token.slice(0, dot));
  const sigBytes = fromBase64Url(token.slice(dot + 1));

  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  if (!valid) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (Date.now() - payload.t > ADMIN_TOKEN_EXPIRY_MS) return false;
    if (payload.e !== expectedEmail) return false;
    return true;
  } catch {
    return false;
  }
}

export async function isAdmin(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.slice(7);
  const adminPasswordHash = c.env.ADMIN_PASSWORD_HASH;
  if (!adminPasswordHash) return false;

  return verifyAdminToken(token, adminPasswordHash, c.env.ADMIN_EMAIL);
}
