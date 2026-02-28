-- ============================================
-- Migration V6: Agent Tools + Audit Tool Calls
-- Adds multi-step agentic workflow support.
-- ============================================

-- Tools config per agent (JSON array of tool names)
ALTER TABLE agents ADD COLUMN tools TEXT;

-- Tool call records in audit logs (JSON array of tool executions)
ALTER TABLE audit_logs ADD COLUMN tool_calls TEXT;
