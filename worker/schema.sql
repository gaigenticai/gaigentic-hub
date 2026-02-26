-- ============================================
-- GaiGentic AI Hub — D1 Schema
-- ============================================

-- Users (Hub signups)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  company_slug TEXT NOT NULL,
  password_hash TEXT,
  chaosbird_username TEXT,
  chaosbird_account_created INTEGER DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'user',
  last_seen_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Agents
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'active',
  sample_input TEXT NOT NULL,
  sample_output TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  guardrails TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Agent Versions (prompt iteration without breaking users)
CREATE TABLE IF NOT EXISTS agent_versions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_id TEXT NOT NULL,
  version TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  guardrails TEXT,
  sample_input TEXT NOT NULL,
  sample_output TEXT NOT NULL,
  changelog TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(agent_id, version)
);

-- API Keys (14-day expiry)
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  agent_id TEXT,
  expires_at TEXT NOT NULL,
  notified_expiry INTEGER DEFAULT 0,
  last_used_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Usage Logs
CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT,
  agent_id TEXT NOT NULL,
  agent_slug TEXT NOT NULL,
  api_key_id TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  response_time_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  is_sandbox INTEGER DEFAULT 0,
  cached INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Response Cache
CREATE TABLE IF NOT EXISTS response_cache (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cache_key TEXT UNIQUE NOT NULL,
  agent_id TEXT NOT NULL,
  response_text TEXT NOT NULL,
  response_metadata TEXT,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  hit_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- RAG Documents (knowledge base chunks)
CREATE TABLE IF NOT EXISTS rag_documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_id TEXT,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  vector_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- LLM Provider Config (per-user, encrypted API keys)
CREATE TABLE IF NOT EXISTS llm_configs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, provider)
);

-- Sandbox Tracking (anonymous users, IP-based)
CREATE TABLE IF NOT EXISTS sandbox_usage (
  ip_address TEXT PRIMARY KEY,
  call_count INTEGER DEFAULT 0,
  first_call_at TEXT DEFAULT (datetime('now')),
  last_call_at TEXT DEFAULT (datetime('now'))
);

-- Rate Limits
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_slug ON users(company_slug);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_agents_slug ON agents(slug);
CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_agent ON usage_logs(user_id, agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_agent ON usage_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_response_cache_key ON response_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_response_cache_expires ON response_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_rag_documents_agent ON rag_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_source ON rag_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_llm_configs_user ON llm_configs(user_id);
