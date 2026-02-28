/**
 * Tool Registry — Central infrastructure for all platform tools.
 *
 * Every tool is registered here. Agents get access to ALL tools by default.
 * The LLM decides which tools to call based on context and input.
 *
 * If an agent has a `tools` column set, it acts as a hint to scope the
 * tool catalog (reduces context noise for focused agents). If null/empty,
 * the agent gets the full catalog.
 */

import type { ToolDefinition } from "./types";
import { ragQueryTool } from "./ragQuery";
import { calculateTool } from "./calculate";
import { dataValidationTool } from "./dataValidation";
import { documentAnalysisTool } from "./documentAnalysis";
import { regulatoryLookupTool } from "./regulatoryLookup";
import { creditAssessmentTool } from "./creditAssessment";
import { collectionsScoringTool } from "./collectionsScoring";

const ALL_TOOLS: Record<string, ToolDefinition> = {
  rag_query: ragQueryTool,
  calculate: calculateTool,
  data_validation: dataValidationTool,
  document_analysis: documentAnalysisTool,
  regulatory_lookup: regulatoryLookupTool,
  credit_assessment: creditAssessmentTool,
  collections_scoring: collectionsScoringTool,
};

/**
 * Get tools for an agent.
 *
 * - If `toolNames` is set: returns those tools (scoped catalog)
 * - If `toolNames` is null: returns ALL tools (full platform access)
 *
 * The LLM always decides which tools to actually call.
 */
export function getAgentTools(
  toolNames: string | null,
): ToolDefinition[] {
  // No tool config = give the agent the full platform catalog
  if (!toolNames) return Object.values(ALL_TOOLS);

  try {
    const names = JSON.parse(toolNames) as string[];
    // If explicitly set, scope to those tools
    return names
      .map((name) => ALL_TOOLS[name])
      .filter((t): t is ToolDefinition => !!t);
  } catch {
    return Object.values(ALL_TOOLS);
  }
}

/**
 * Get a single tool by name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return ALL_TOOLS[name];
}

/**
 * Get all registered tools.
 */
export function getAllTools(): ToolDefinition[] {
  return Object.values(ALL_TOOLS);
}
