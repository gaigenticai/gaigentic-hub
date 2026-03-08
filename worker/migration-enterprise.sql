-- Migration: Enterprise features (webhooks, A/B experiments)
-- Run: cd worker && npx wrangler d1 execute gaigentic-hub-db --file=./migration-enterprise.sql --remote

-- Webhooks for event notifications
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '["execution.complete","execution.error"]',
  secret TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);

-- A/B prompt experiments
CREATE TABLE IF NOT EXISTS prompt_experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  variant_a_prompt TEXT NOT NULL,
  variant_b_prompt TEXT NOT NULL,
  traffic_split REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','running','paused','completed')),
  winner TEXT CHECK(winner IN ('a','b')),
  total_a INTEGER NOT NULL DEFAULT 0,
  total_b INTEGER NOT NULL DEFAULT 0,
  avg_rating_a REAL,
  avg_rating_b REAL,
  created_by INTEGER,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_experiments_agent ON prompt_experiments(agent_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON prompt_experiments(status);

-- Experiment execution results
CREATE TABLE IF NOT EXISTS experiment_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL,
  variant TEXT NOT NULL CHECK(variant IN ('a','b')),
  usage_log_id INTEGER,
  audit_log_id INTEGER,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5),
  response_time_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expr_results_exp ON experiment_results(experiment_id);
CREATE INDEX IF NOT EXISTS idx_expr_results_variant ON experiment_results(experiment_id, variant);
