-- ============================================
-- GaiGentic AI Hub — Migration v2
-- Adds: capabilities, jurisdictions, featured columns on agents
-- Adds: audit_logs table, feedback table
-- ============================================

-- Add new columns to agents table (SQLite ALTER TABLE ADD COLUMN)
ALTER TABLE agents ADD COLUMN capabilities TEXT;
ALTER TABLE agents ADD COLUMN jurisdictions TEXT;
ALTER TABLE agents ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

-- Audit Logs (full input/output capture for every execution)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  usage_log_id TEXT,
  user_id TEXT,
  agent_id TEXT NOT NULL,
  agent_slug TEXT NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT,
  rag_sources TEXT,
  system_prompt_hash TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  temperature REAL,
  max_tokens INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Feedback (validated human feedback -> RAG ingestion)
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  audit_log_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  correction TEXT,
  validated INTEGER NOT NULL DEFAULT 0,
  ingested INTEGER NOT NULL DEFAULT 0,
  validated_by TEXT,
  validated_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- New indexes
CREATE INDEX IF NOT EXISTS idx_agents_featured ON agents(featured);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent ON audit_logs(agent_slug, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_usage ON audit_logs(usage_log_id);
CREATE INDEX IF NOT EXISTS idx_feedback_audit ON feedback(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_validated ON feedback(validated);
