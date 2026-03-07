-- Skills: reusable capability building blocks for agents
-- Each skill bundles a prompt template + required tools + domain patterns
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- verification, compliance, analysis, processing, intelligence, communication
  icon TEXT NOT NULL,
  -- What tools this skill requires from central infra
  required_tools TEXT NOT NULL DEFAULT '[]', -- JSON array of tool names
  -- Prompt template injected into agent's system prompt as <skill> block
  prompt_template TEXT NOT NULL,
  -- What inputs this skill typically expects
  input_hints TEXT DEFAULT '[]', -- JSON array of field names
  -- What visual outputs this skill produces
  visual_outputs TEXT DEFAULT '[]', -- JSON array: ["kpi", "radar_chart", "table"]
  -- Metadata
  reuse_count INTEGER DEFAULT 0,
  created_by TEXT DEFAULT 'system', -- 'system' or user_id
  status TEXT DEFAULT 'active', -- active, draft, deprecated
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Junction table: which skills an agent uses
CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (agent_id, skill_id),
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (skill_id) REFERENCES skills(id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_skill ON agent_skills(skill_id);
