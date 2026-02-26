import { Hono } from "hono";
import type { Env, DocumentUploadRow } from "../types";
import { getSessionUser } from "../session";
import { validateFile, processDocument } from "../documentProcessor";

const documents = new Hono<{ Bindings: Env }>();

// POST /documents/upload — Upload a file, store in R2, extract text
documents.post("/upload", async (c) => {
  const contentType = c.req.header("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "multipart/form-data required" }, 400);
  }

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const clientText = formData.get("client_text") as string | null;
  const agentSlug = formData.get("agent_slug") as string | null;

  if (!file) {
    return c.json({ error: "file is required" }, 400);
  }

  // Validate file
  const validation = validateFile(file.type, file.size);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // Auth (optional — sandbox users can upload too)
  const email = await getSessionUser(c);
  let userId: string | null = null;
  if (email) {
    const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string }>();
    userId = user?.id || null;
  }

  // Generate R2 key
  const prefix = userId || "anon";
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const r2Key = `uploads/${prefix}/${timestamp}-${safeName}`;

  // Read file bytes
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  // Store raw file in R2 for audit trail
  await c.env.DOCUMENTS.put(r2Key, fileBytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name,
      uploadedBy: userId || "anonymous",
      uploadedAt: new Date().toISOString(),
    },
  });

  // Insert DB row (status: pending)
  const docId = crypto.randomUUID().replace(/-/g, "").slice(0, 32);

  await c.env.DB.prepare(
    `INSERT INTO document_uploads (id, user_id, agent_slug, file_name, file_type, file_size, r2_key, client_extracted_text, extraction_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  )
    .bind(
      docId,
      userId,
      agentSlug,
      file.name,
      file.type,
      file.size,
      r2Key,
      clientText,
    )
    .run();

  // Run server-side text extraction
  let serverText = "";
  let extractionStatus = "completed";
  let extractionError: string | null = null;

  let extractionMethod = "";
  try {
    const result = await processDocument(c.env.AI, fileBytes, file.type, c.env.ZAI_API_KEY, c.env.ZAI_BASE_URL);
    serverText = result.text;
    extractionMethod = result.method;

    if (!serverText && clientText) {
      serverText = clientText;
      extractionMethod += "+client-fallback";
    }
  } catch (err) {
    extractionError = err instanceof Error ? err.message : "Extraction failed";
    extractionStatus = clientText ? "completed" : "failed";
    serverText = clientText || "";
  }

  // Update row with extracted text
  await c.env.DB.prepare(
    `UPDATE document_uploads
     SET server_extracted_text = ?, extraction_status = ?, extraction_error = ?
     WHERE id = ?`,
  )
    .bind(serverText || null, extractionStatus, extractionError || extractionMethod || null, docId)
    .run();

  // Determine the best available text
  const extractedText = serverText || clientText || null;

  return c.json({
    document: {
      id: docId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      extracted_text: extractedText,
      status: extractionStatus,
      error: extractionError,
    },
  });
});

// GET /documents/:id — Get document metadata + extracted text
documents.get("/:id", async (c) => {
  const id = c.req.param("id");

  const doc = await c.env.DB.prepare(
    `SELECT id, user_id, agent_slug, file_name, file_type, file_size,
            client_extracted_text, server_extracted_text,
            extraction_status, extraction_error, created_at
     FROM document_uploads WHERE id = ?`,
  )
    .bind(id)
    .first<DocumentUploadRow>();

  if (!doc) return c.json({ error: "Document not found" }, 404);

  return c.json({
    document: {
      id: doc.id,
      file_name: doc.file_name,
      file_type: doc.file_type,
      file_size: doc.file_size,
      extracted_text: doc.server_extracted_text || doc.client_extracted_text,
      client_text: doc.client_extracted_text,
      server_text: doc.server_extracted_text,
      status: doc.extraction_status,
      error: doc.extraction_error,
      created_at: doc.created_at,
    },
  });
});

// DELETE /documents/:id — Delete document from R2 + D1
documents.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const email = await getSessionUser(c);
  if (!email) return c.json({ error: "Unauthorized" }, 401);

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string }>();
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const doc = await c.env.DB.prepare(
    "SELECT id, user_id, r2_key FROM document_uploads WHERE id = ?",
  )
    .bind(id)
    .first<{ id: string; user_id: string | null; r2_key: string }>();

  if (!doc) return c.json({ error: "Document not found" }, 404);

  // Owner check
  if (doc.user_id && doc.user_id !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Delete from R2
  await c.env.DOCUMENTS.delete(doc.r2_key);

  // Delete from D1
  await c.env.DB.prepare("DELETE FROM document_uploads WHERE id = ?")
    .bind(id)
    .run();

  return c.json({ success: true });
});

export default documents;
