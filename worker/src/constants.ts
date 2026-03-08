// Status enums — single source of truth
export const AGENT_STATUS = { ACTIVE: "active", DEPRECATED: "deprecated", COMING_SOON: "coming_soon" } as const;
export const SKILL_STATUS = { ACTIVE: "active", DRAFT: "draft", ARCHIVED: "archived" } as const;
export const EXPERIMENT_STATUS = { DRAFT: "draft", RUNNING: "running", PAUSED: "paused", COMPLETED: "completed" } as const;

export const AGENT_CATEGORIES = [
  "accounting",
  "underwriting",
  "compliance",
  "collections",
  "credit",
  "infrastructure",
  "intelligence",
  "disputes",
  "identity",
  "payments",
  "lending",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  accounting: "Accounting",
  underwriting: "Underwriting",
  compliance: "Compliance",
  collections: "Collections",
  credit: "Credit",
  infrastructure: "Infrastructure",
  intelligence: "Intelligence",
  disputes: "Disputes",
  identity: "Identity",
  payments: "Payments",
  lending: "Lending",
};

// Trial quotas
export const SANDBOX_MAX_CALLS = 3;
export const TRIAL_MAX_CALLS_PER_AGENT = 50;
export const TRIAL_DURATION_DAYS = 14;
export const API_KEY_EXPIRY_DAYS = 14;
export const EXPIRY_WARNING_DAYS = 3;

// Rate limits
export const AUTH_RATE_LIMIT = 10; // 10 per 5 min
export const AUTH_RATE_WINDOW_MS = 5 * 60 * 1000;
export const PLAYGROUND_RATE_LIMIT = 30; // 30 per minute
export const PLAYGROUND_RATE_WINDOW_MS = 60 * 1000;
export const API_RATE_LIMIT = 60; // 60 per minute
export const API_RATE_WINDOW_MS = 60 * 1000;
export const ADMIN_RATE_LIMIT = 60; // 60 per minute
export const ADMIN_RATE_WINDOW_MS = 60 * 1000;
export const BUILDER_RATE_LIMIT = 10; // 10 per minute
export const BUILDER_RATE_WINDOW_MS = 60 * 1000;
export const CHAT_RATE_LIMIT = 5; // 5 per minute
export const CHAT_RATE_WINDOW_MS = 60 * 1000;

// Response cache TTL
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Blocked email domains (require business email on signup)
export const BLOCKED_EMAIL_DOMAINS = [
  "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com",
  "aol.com", "icloud.com", "me.com", "mac.com", "protonmail.com",
  "proton.me", "mail.com", "zoho.com", "yandex.com", "gmx.com", "gmx.net",
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "yopmail.com",
];

export function isBlockedEmailDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return BLOCKED_EMAIL_DOMAINS.includes(domain) ? domain : null;
}
