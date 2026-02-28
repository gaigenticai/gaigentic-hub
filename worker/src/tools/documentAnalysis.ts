/**
 * Document Analysis Tool — Extract and analyze uploaded document content.
 */

import type { ToolDefinition } from "./types";

export const documentAnalysisTool: ToolDefinition = {
  name: "document_analysis",
  description:
    "Analyze uploaded documents that have already been extracted. Searches the document context for specific information, extracts key fields, or summarizes sections. Use this when you need to find specific data within attached documents.",
  parameters: {
    action: {
      type: "string",
      description:
        'Action to perform: "search" (find text), "extract_fields" (pull key values), "summarize"',
      required: true,
    },
    query: {
      type: "string",
      description: "What to search for or extract from the document",
      required: true,
    },
  },
  async execute(params, _env, context) {
    const action = params.action as string;
    const query = params.query as string;

    if (!context.documentContext) {
      return {
        success: false,
        data: null,
        summary: "No documents uploaded for this execution",
      };
    }

    const docText = context.documentContext;

    switch (action) {
      case "search": {
        const lowerQuery = query.toLowerCase();
        const lines = docText.split("\n");
        const matches = lines.filter((line) =>
          line.toLowerCase().includes(lowerQuery),
        );

        return {
          success: true,
          data: {
            query,
            matches_found: matches.length,
            matches: matches.slice(0, 10),
          },
          summary: `Found ${matches.length} matches for "${query}" in documents`,
        };
      }

      case "extract_fields": {
        // Try to extract key-value pairs from the document
        const lines = docText.split("\n");
        const fields: Record<string, string> = {};
        const queryTerms = query.toLowerCase().split(",").map((t) => t.trim());

        for (const line of lines) {
          for (const term of queryTerms) {
            if (line.toLowerCase().includes(term)) {
              // Try to extract value after colon or equals
              const colonMatch = line.match(/:\s*(.+)/);
              const equalsMatch = line.match(/=\s*(.+)/);
              const value = colonMatch?.[1] || equalsMatch?.[1] || line;
              fields[term] = value.trim();
            }
          }
        }

        return {
          success: true,
          data: { fields },
          summary: `Extracted ${Object.keys(fields).length} fields: ${Object.keys(fields).join(", ")}`,
        };
      }

      case "summarize": {
        // Return document stats and first N characters
        const wordCount = docText.split(/\s+/).length;
        const lineCount = docText.split("\n").length;
        const preview = docText.slice(0, 500);

        return {
          success: true,
          data: { wordCount, lineCount, preview },
          summary: `Document: ${wordCount} words, ${lineCount} lines`,
        };
      }

      default:
        return {
          success: false,
          data: null,
          summary: `Unknown action: ${action}`,
        };
    }
  },
};
