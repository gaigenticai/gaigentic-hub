import { Hono } from "hono";
import type { Env, RagDocumentRow } from "../types";
import { isAdmin } from "../adminAuth";
import { ingestDocument } from "../rag";

const rag = new Hono<{ Bindings: Env }>();

// Admin middleware
rag.use("*", async (c, next) => {
  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

// POST /rag/ingest — Ingest document into knowledge base
rag.post("/ingest", async (c) => {
  const body = await c.req.json<{
    agent_id?: string;
    source_type: string;
    source_name: string;
    content: string;
    metadata?: Record<string, string>;
  }>();

  if (!body.source_type || !body.source_name || !body.content) {
    return c.json({ error: "source_type, source_name, and content are required" }, 400);
  }

  const result = await ingestDocument(c.env, {
    agentId: body.agent_id || null,
    sourceType: body.source_type,
    sourceName: body.source_name,
    content: body.content,
    metadata: body.metadata,
  });

  return c.json({ success: true, chunks_inserted: result.chunks_inserted });
});

// GET /rag/documents — List all RAG documents
rag.get("/documents", async (c) => {
  const agentId = c.req.query("agent_id");

  let query =
    "SELECT id, agent_id, source_type, source_name, chunk_index, vector_id, created_at FROM rag_documents";
  const binds: string[] = [];

  if (agentId) {
    query += " WHERE agent_id = ?";
    binds.push(agentId);
  }

  query += " ORDER BY created_at DESC LIMIT 200";

  const stmt = binds.length
    ? c.env.DB.prepare(query).bind(...binds)
    : c.env.DB.prepare(query);

  const result = await stmt.all<RagDocumentRow>();
  return c.json({ documents: result.results });
});

// DELETE /rag/documents/:id — Remove document + vectors
rag.delete("/documents/:id", async (c) => {
  const id = c.req.param("id");

  // Get vector_id before deleting
  const doc = await c.env.DB.prepare(
    "SELECT vector_id FROM rag_documents WHERE id = ?",
  )
    .bind(id)
    .first<{ vector_id: string | null }>();

  if (!doc) return c.json({ error: "Document not found" }, 404);

  // Delete from D1
  await c.env.DB.prepare("DELETE FROM rag_documents WHERE id = ?")
    .bind(id)
    .run();

  // Delete from Vectorize
  if (doc.vector_id) {
    try {
      await c.env.VECTORIZE.deleteByIds([doc.vector_id]);
    } catch {
      // Vectorize deletion is best-effort
    }
  }

  return c.json({ success: true });
});

export default rag;
