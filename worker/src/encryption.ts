/**
 * AES-256-GCM encryption for user LLM API keys.
 * Keys are encrypted before storing in D1.
 */

async function getAesKey(secret: string): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(
  plaintext: string,
  secret: string,
): Promise<string> {
  const key = await getAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  // Format: base64(iv):base64(ciphertext)
  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(
    String.fromCharCode(...new Uint8Array(ciphertext)),
  );
  return `${ivB64}:${ctB64}`;
}

export async function decrypt(
  encrypted: string,
  secret: string,
): Promise<string> {
  const [ivB64, ctB64] = encrypted.split(":");
  if (!ivB64 || !ctB64) throw new Error("Invalid encrypted format");

  const key = await getAesKey(secret);
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0));

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plainBuffer);
}
