-- ============================================
-- GaiGentic AI Hub — Migration v3
-- Adds: document_uploads table for file processing pipeline
-- ============================================

CREATE TABLE IF NOT EXISTS document_uploads (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT,
  agent_slug TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  client_extracted_text TEXT,
  server_extracted_text TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extraction_error TEXT,
  auto_ingested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_doc_uploads_user ON document_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_uploads_r2key ON document_uploads(r2_key);
CREATE INDEX IF NOT EXISTS idx_doc_uploads_agent ON document_uploads(agent_slug);
