/**
 * Chaosbird integration for lead communication.
 * Auto-creates accounts on signup, sends messages from admin.
 *
 * Chaosbird inbox API uses API keys (cbk_...), not session tokens.
 * Endpoint: POST /inbox/{username}/message
 */

/**
 * Generate a Chaosbird username from company name.
 * Format: gai_{first 6 alphanumeric chars of company, lowercased}
 * Chaosbird rejects dashes — use underscores only.
 * Chaosbird requires: 2-10 chars total
 */
export function generateChaosbirdUsername(companyName: string): string {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  return `gai_${slug || "user"}`;
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

    // Check if the response indicates password is required (existing user)
    const body = await res.json().catch(() => ({})) as { needs_password?: boolean };
    if (body.needs_password) {
      // Username is taken by a password-protected account — try with random suffix
      const fallback = `${username.slice(0, 7)}${Math.floor(10 + Math.random() * 89)}`;
      const res2 = await fetch(`${chaosbirdApiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: fallback }),
      });
      return { username: fallback, success: res2.ok };
    }

    // Other error — try with random suffix anyway
    const fallback = `${username.slice(0, 7)}${Math.floor(10 + Math.random() * 89)}`;
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
 * Send a message to a Hub user's Chaosbird inbox.
 * Uses admin's API key (cbk_...) to post to the user's inbox.
 */
export async function sendChaosbirdMessage(
  chaosbirdApiUrl: string,
  adminApiKey: string,
  receiverUsername: string,
  content: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${chaosbirdApiUrl}/inbox/${receiverUsername}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminApiKey}`,
      },
      body: JSON.stringify({ sender_name: "gaigentic Agent Hub", content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a lead notification to Krishna's Chaosbird inbox.
 * Uses Krishna's own API key to post a message to his own inbox,
 * with sender_name identifying the new signup.
 */
/**
 * Send a welcome message to a new Hub user's Chaosbird inbox.
 * They see this when they visit their inbox — conversation already started.
 */
export async function sendWelcomeMessage(
  chaosbirdApiUrl: string,
  adminApiKey: string,
  receiverUsername: string,
  userName: string,
): Promise<boolean> {
  const content = [
    `Welcome to gaigentic Agent Hub, ${userName}!`,
    ``,
    `Your 14-day free trial is now active. Here's how to get started:`,
    `1. Browse our AI agents at hub.gaigentic.ai/agents`,
    `2. Test them in the Playground with sample data`,
    `3. Generate an API key from your Dashboard`,
    ``,
    `Reply here anytime to chat with Krishna directly.`,
  ].join("\n");

  return sendChaosbirdMessage(
    chaosbirdApiUrl,
    adminApiKey,
    receiverUsername,
    content,
  );
}

/**
 * Send a lead notification to Krishna's Chaosbird inbox.
 * Uses Krishna's own API key to post a message to his own inbox,
 * with sender_name identifying the new signup.
 */
export async function sendLeadNotification(
  chaosbirdApiUrl: string,
  adminApiKey: string,
  adminUsername: string,
  userDetails: { name: string; email: string; company: string; chaosbirdUsername: string },
): Promise<boolean> {
  try {
    const message = [
      `New gaigentic Agent Hub Signup`,
      `Name: ${userDetails.name}`,
      `Email: ${userDetails.email}`,
      `Company: ${userDetails.company}`,
      `Username: ${userDetails.chaosbirdUsername}`,
    ].join("\n");

    const res = await fetch(`${chaosbirdApiUrl}/inbox/${adminUsername}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminApiKey}`,
      },
      body: JSON.stringify({
        sender_name: userDetails.chaosbirdUsername,
        content: message,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
