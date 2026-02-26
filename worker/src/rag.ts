/**
 * RAG Pipeline — Centralized knowledge base.
 * Uses Cloudflare Vectorize + Workers AI for embeddings.
 */

import type { Env, RagDocumentRow } from "./types";

/**
 * Chunk a document into overlapping segments.
 */
export function chunkDocument(
  text: string,
  chunkSize = 512,
  overlap = 50,
): string[] {
  const words = text.split(/\s+/);
  if (words.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Generate embeddings using Workers AI.
 * Model: @cf/baai/bge-base-en-v1.5 (768 dimensions)
 */
export async function generateEmbeddings(
  ai: Ai,
  texts: string[],
): Promise<number[][]> {
  const result = await ai.run("@cf/baai/bge-base-en-v1.5", {
    text: texts,
  });
  return (result as { data: number[][] }).data;
}

/**
 * Ingest a document: chunk → embed → store in Vectorize + D1.
 */
export async function ingestDocument(
  env: Env,
  params: {
    agentId: string | null;
    sourceType: string;
    sourceName: string;
    content: string;
    metadata?: Record<string, string>;
  },
): Promise<{ chunks_inserted: number }> {
  const chunks = chunkDocument(params.content);
  if (chunks.length === 0) return { chunks_inserted: 0 };

  // Generate embeddings (batch)
  const embeddings = await generateEmbeddings(env.AI, chunks);

  // Prepare D1 inserts and Vectorize upserts
  const vectors: VectorizeVector[] = [];
  const dbInserts: Promise<D1Result>[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const vectorId = crypto.randomUUID();

    vectors.push({
      id: vectorId,
      values: embeddings[i],
      metadata: {
        agent_id: params.agentId || "shared",
        source_type: params.sourceType,
        source_name: params.sourceName,
        chunk_index: i,
      },
    });

    dbInserts.push(
      env.DB.prepare(
        `INSERT INTO rag_documents (agent_id, source_type, source_name, chunk_index, content, metadata, vector_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          params.agentId,
          params.sourceType,
          params.sourceName,
          i,
          chunks[i],
          params.metadata ? JSON.stringify(params.metadata) : null,
          vectorId,
        )
        .run(),
    );
  }

  // Upsert vectors in batches of 100
  for (let i = 0; i < vectors.length; i += 100) {
    await env.VECTORIZE.upsert(vectors.slice(i, i + 100));
  }

  await Promise.all(dbInserts);

  return { chunks_inserted: chunks.length };
}

/**
 * Query the knowledge base for relevant context.
 */
export async function queryKnowledge(
  env: Env,
  params: {
    query: string;
    agentId?: string;
    topK?: number;
    scoreThreshold?: number;
  },
): Promise<
  Array<{
    content: string;
    source_name: string;
    source_type: string;
    score: number;
  }>
> {
  const topK = params.topK || 5;
  const threshold = params.scoreThreshold || 0.7;

  // Embed the query
  const embeddings = await generateEmbeddings(env.AI, [params.query]);
  const queryVector = embeddings[0];

  // Build filter: agent-specific + shared knowledge
  const filter: VectorizeVectorMetadataFilter = params.agentId
    ? { agent_id: { $in: [params.agentId, "shared"] } }
    : {};

  const matches = await env.VECTORIZE.query(queryVector, {
    topK,
    returnMetadata: "all",
    filter,
  });

  // Filter by score threshold
  const relevant = matches.matches.filter((m) => (m.score || 0) >= threshold);

  if (relevant.length === 0) return [];

  // Fetch full text from D1
  const vectorIds = relevant.map((m) => `'${m.id}'`).join(",");
  const docs = await env.DB.prepare(
    `SELECT content, source_name, source_type, vector_id FROM rag_documents WHERE vector_id IN (${vectorIds})`,
  ).all<RagDocumentRow>();

  // Join scores with content
  const scoreMap = new Map(relevant.map((m) => [m.id, m.score || 0]));

  return docs.results.map((doc) => ({
    content: doc.content,
    source_name: doc.source_name,
    source_type: doc.source_type,
    score: scoreMap.get(doc.vector_id || "") || 0,
  }));
}
