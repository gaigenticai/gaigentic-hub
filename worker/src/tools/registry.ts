/**
 * Tool Registry — Central map of all available tools.
 */

import type { ToolDefinition } from "./types";
import { ragQueryTool } from "./ragQuery";
import { calculateTool } from "./calculate";
import { dataValidationTool } from "./dataValidation";
import { documentAnalysisTool } from "./documentAnalysis";
import { regulatoryLookupTool } from "./regulatoryLookup";

const ALL_TOOLS: Record<string, ToolDefinition> = {
  rag_query: ragQueryTool,
  calculate: calculateTool,
  data_validation: dataValidationTool,
  document_analysis: documentAnalysisTool,
  regulatory_lookup: regulatoryLookupTool,
};

/**
 * Get tools for an agent based on its tools config.
 * @param toolNames JSON array of tool names from agent.tools column, or null for no tools.
 */
export function getAgentTools(
  toolNames: string | null,
): ToolDefinition[] {
  if (!toolNames) return [];

  try {
    const names = JSON.parse(toolNames) as string[];
    return names
      .map((name) => ALL_TOOLS[name])
      .filter((t): t is ToolDefinition => !!t);
  } catch {
    return [];
  }
}

/**
 * Get a single tool by name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return ALL_TOOLS[name];
}
