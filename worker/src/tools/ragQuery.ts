/**
 * RAG Query Tool — Search the agent's knowledge base.
 */

import type { ToolDefinition } from "./types";
import { queryKnowledge } from "../rag";

export const ragQueryTool: ToolDefinition = {
  name: "rag_query",
  description:
    "Search the knowledge base for relevant regulations, policies, or reference data. Use this when you need specific regulatory information, precedents, or domain knowledge to support your analysis.",
  parameters: {
    query: {
      type: "string",
      description: "The search query describing what information you need",
      required: true,
    },
    topK: {
      type: "number",
      description: "Number of results to return (default: 5, max: 10)",
    },
  },
  async execute(params, env, context) {
    const query = params.query as string;
    const topK = Math.min((params.topK as number) || 5, 10);

    const results = await queryKnowledge(env, {
      query,
      agentId: context.agentId,
      topK,
      scoreThreshold: 0.65,
    });

    if (results.length === 0) {
      return {
        success: true,
        data: { results: [] },
        summary: `No relevant knowledge found for "${query}"`,
      };
    }

    return {
      success: true,
      data: {
        results: results.map((r) => ({
          content: r.content,
          source: r.source_name,
          type: r.source_type,
          relevance: Math.round(r.score * 100) + "%",
        })),
      },
      summary: `Found ${results.length} relevant knowledge entries from ${[...new Set(results.map((r) => r.source_name))].join(", ")}`,
    };
  },
};
