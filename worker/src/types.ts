export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  AI: Ai;
  VECTORIZE: VectorizeIndex;

  // Secrets (set via wrangler secret put)
  SESSION_SECRET: string;
  ZAI_API_KEY: string;
  ENCRYPTION_KEY: string;
  ADMIN_PASSWORD_HASH: string;
  CHAOSBIRD_ADMIN_TOKEN: string;

  // Vars (set in wrangler.toml)
  CHAOSBIRD_API_URL: string;
  DEFAULT_LLM_PROVIDER: string;
  DEFAULT_LLM_MODEL: string;
  ZAI_BASE_URL: string;
  ADMIN_EMAIL: string;
}

// ==========================================
// Database Row Types
// ==========================================

export interface UserRow {
  id: string;
  name: string;
  email: string;
  company_name: string;
  company_slug: string;
  password_hash: string | null;
  chaosbird_username: string | null;
  chaosbird_account_created: number;
  role: string;
  last_seen_at: string | null;
  created_at: string;
}

export interface AgentRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  version: string;
  status: string;
  sample_input: string;
  sample_output: string;
  system_prompt: string;
  guardrails: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  key_prefix: string;
  key_hash: string;
  agent_id: string | null;
  expires_at: string;
  notified_expiry: number;
  last_used_at: string | null;
  revoked: number;
  created_at: string;
}

export interface UsageLogRow {
  id: string;
  user_id: string | null;
  agent_id: string;
  agent_slug: string;
  api_key_id: string | null;
  input_tokens: number;
  output_tokens: number;
  llm_provider: string;
  llm_model: string;
  response_time_ms: number;
  status: string;
  error_message: string | null;
  is_sandbox: number;
  cached: number;
  created_at: string;
}

export interface RagDocumentRow {
  id: string;
  agent_id: string | null;
  source_type: string;
  source_name: string;
  chunk_index: number;
  content: string;
  metadata: string | null;
  vector_id: string | null;
  created_at: string;
}

export interface LlmConfigRow {
  id: string;
  user_id: string;
  provider: string;
  api_key_encrypted: string;
  is_default: number;
  created_at: string;
}

export interface ResponseCacheRow {
  id: string;
  cache_key: string;
  agent_id: string;
  response_text: string;
  response_metadata: string | null;
  llm_provider: string;
  llm_model: string;
  hit_count: number;
  created_at: string;
  expires_at: string;
}
