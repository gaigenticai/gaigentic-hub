import { Hono } from "hono";
import type { Env, FeedbackRow } from "../types";
import { getSessionUser } from "../session";
import { isAdmin } from "../adminAuth";
import { ingestDocument } from "../rag";

const feedback = new Hono<{ Bindings: Env }>();

// POST /feedback — submit feedback for an agent execution
feedback.post("/", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Authentication required" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: "User not found" }, 404);

  const body = await c.req.json<{
    audit_log_id: string;
    rating: number;
    comment?: string;
    correction?: string;
  }>();

  if (!body.audit_log_id || !body.rating) {
    return c.json({ error: "audit_log_id and rating are required" }, 400);
  }

  if (body.rating < 1 || body.rating > 5) {
    return c.json({ error: "Rating must be 1-5" }, 400);
  }

  // Verify audit log exists
  const auditLog = await c.env.DB.prepare(
    "SELECT id FROM audit_logs WHERE id = ?",
  )
    .bind(body.audit_log_id)
    .first<{ id: string }>();

  if (!auditLog) return c.json({ error: "Audit log not found" }, 404);

  // Check for duplicate feedback
  const existing = await c.env.DB.prepare(
    "SELECT id FROM feedback WHERE audit_log_id = ? AND user_id = ?",
  )
    .bind(body.audit_log_id, user.id)
    .first<{ id: string }>();

  if (existing) {
    return c.json({ error: "Feedback already submitted for this execution" }, 409);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO feedback (audit_log_id, user_id, rating, comment, correction)
     VALUES (?, ?, ?, ?, ?)
     RETURNING id`,
  )
    .bind(
      body.audit_log_id,
      user.id,
      body.rating,
      body.comment || null,
      body.correction || null,
    )
    .first<{ id: string }>();

  return c.json({ id: result?.id, success: true });
});

// GET /feedback/:audit_log_id — get feedback for a specific execution
feedback.get("/:auditLogId", async (c) => {
  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Authentication required" }, 401);

  const auditLogId = c.req.param("auditLogId");

  const fb = await c.env.DB.prepare(
    "SELECT id, rating, comment, correction, created_at FROM feedback WHERE audit_log_id = ?",
  )
    .bind(auditLogId)
    .all<FeedbackRow>();

  return c.json({ feedback: fb.results });
});

// ==========================================
// Admin endpoints
// ==========================================

// GET /feedback/admin/pending — list unvalidated feedback
feedback.get("/admin/pending", async (c) => {
  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);

  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const offset = (page - 1) * limit;

  const results = await c.env.DB.prepare(
    `SELECT f.*, al.agent_slug, al.input_text, al.output_text, u.name as user_name, u.email as user_email
     FROM feedback f
     JOIN audit_logs al ON f.audit_log_id = al.id
     JOIN users u ON f.user_id = u.id
     WHERE f.validated = 0
     ORDER BY f.created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(limit, offset)
    .all();

  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as total FROM feedback WHERE validated = 0",
  ).first<{ total: number }>();

  return c.json({
    feedback: results.results,
    total: count?.total || 0,
  });
});

// POST /feedback/admin/:id/validate — approve feedback, optionally ingest into RAG
feedback.post("/admin/:id/validate", async (c) => {
  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);

  const feedbackId = c.req.param("id");
  const body = await c.req.json<{ ingest?: boolean }>();

  const fb = await c.env.DB.prepare(
    "SELECT f.*, al.agent_id, al.agent_slug FROM feedback f JOIN audit_logs al ON f.audit_log_id = al.id WHERE f.id = ?",
  )
    .bind(feedbackId)
    .first<FeedbackRow & { agent_id: string; agent_slug: string }>();

  if (!fb) return c.json({ error: "Feedback not found" }, 404);

  const adminEmail = await getSessionUser(c);

  // Mark as validated
  await c.env.DB.prepare(
    "UPDATE feedback SET validated = 1, validated_by = ?, validated_at = datetime('now') WHERE id = ?",
  )
    .bind(adminEmail || "admin", feedbackId)
    .run();

  // Optionally ingest correction into RAG
  if (body.ingest && fb.correction) {
    try {
      const ingestResult = await ingestDocument(c.env, {
        agentId: fb.agent_id,
        sourceType: "user_feedback",
        sourceName: `Validated feedback for ${fb.agent_slug} (${feedbackId})`,
        content: fb.correction,
        metadata: {
          feedback_id: feedbackId,
          user_id: fb.user_id,
          rating: String(fb.rating),
        },
      });

      await c.env.DB.prepare("UPDATE feedback SET ingested = 1 WHERE id = ?")
        .bind(feedbackId)
        .run();

      return c.json({ success: true, ingested: true, chunks: ingestResult.chunks_inserted });
    } catch (err) {
      return c.json({
        success: true,
        ingested: false,
        ingest_error: (err as Error).message,
      });
    }
  }

  return c.json({ success: true, ingested: false });
});

// POST /feedback/admin/:id/reject — reject bad feedback
feedback.post("/admin/:id/reject", async (c) => {
  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);

  const feedbackId = c.req.param("id");
  const adminEmail = await getSessionUser(c);

  await c.env.DB.prepare(
    "UPDATE feedback SET validated = -1, validated_by = ?, validated_at = datetime('now') WHERE id = ?",
  )
    .bind(adminEmail || "admin", feedbackId)
    .run();

  return c.json({ success: true });
});

export default feedback;
