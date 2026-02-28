-- ============================================
-- Migration V7: Agent Steps — full execution trace
-- Every tool call, data fetch, reasoning step, and decision
-- recorded for auditability and explainability.
-- ============================================

CREATE TABLE IF NOT EXISTS agent_steps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  audit_log_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL,           -- tool_call, data_fetch, llm_reasoning, rule_check, decision
  tool_name TEXT,                    -- e.g. rag_query, calculate, data_validation
  label TEXT NOT NULL,               -- human-readable description
  input_data TEXT,                   -- JSON: what was sent to the tool/LLM
  output_data TEXT,                  -- JSON: what came back
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'completed',  -- running, completed, error
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_steps_audit ON agent_steps(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_type ON agent_steps(step_type);
