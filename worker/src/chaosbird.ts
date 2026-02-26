/**
 * Chaosbird integration for lead communication.
 * Auto-creates accounts on signup, sends messages from admin.
 */

/**
 * Generate a Chaosbird username from company name.
 * Format: gai-{first 6 alphanumeric chars of company, lowercased}
 * Chaosbird requires: 2-10 chars total
 */
export function generateChaosbirdUsername(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  return `gai-${slug || "user"}`;
}

/**
 * Create a Chaosbird account for a new Hub signup.
 * Chaosbird auto-creates users on login if they don't exist.
 */
export async function createChaosbirdAccount(
  chaosbirdApiUrl: string,
  companyName: string,
): Promise<{ username: string; success: boolean }> {
  const username = generateChaosbirdUsername(companyName);

  try {
    const res = await fetch(`${chaosbirdApiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (res.ok) {
      return { username, success: true };
    }

    // If username taken, try with random suffix
    const fallback = `${username.slice(0, 7)}${Math.floor(Math.random() * 99)}`;
    const res2 = await fetch(`${chaosbirdApiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: fallback }),
    });

    return { username: fallback, success: res2.ok };
  } catch {
    return { username, success: false };
  }
}

/**
 * Send a message to a Hub user via their Chaosbird account.
 * Used by admin to contact leads.
 */
export async function sendChaosbirdMessage(
  chaosbirdApiUrl: string,
  senderSessionToken: string,
  receiverUsername: string,
  content: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${chaosbirdApiUrl}/inbox/${receiverUsername}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${senderSessionToken}`,
      },
      body: JSON.stringify({ sender_name: "GaiGentic Hub", content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
