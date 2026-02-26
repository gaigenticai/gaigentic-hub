export const AGENT_CATEGORIES = [
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
export const API_KEY_EXPIRY_DAYS = 14;
export const EXPIRY_WARNING_DAYS = 3;

// Rate limits
export const AUTH_RATE_LIMIT = 10; // 10 per 5 min
export const AUTH_RATE_WINDOW_MS = 5 * 60 * 1000;
export const PLAYGROUND_RATE_LIMIT = 30; // 30 per minute
export const PLAYGROUND_RATE_WINDOW_MS = 60 * 1000;
export const API_RATE_LIMIT = 60; // 60 per minute
export const API_RATE_WINDOW_MS = 60 * 1000;

// Response cache TTL
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
