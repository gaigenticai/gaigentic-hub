/**
 * Context Engine — Builds structured context for agentic execution.
 *
 * Inspired by Regulens context engineering and Claude Code's architecture:
 * - Present ALL tools with self-describing schemas
 * - Give the LLM full context (who, why, what objective)
 * - Let the LLM autonomously decide which tools to call
 * - NO hardcoded per-agent workflows
 *
 * Context is structured with XML-tagged sections so the LLM can
 * parse it hierarchically and prioritize high-signal information.
 */

import type { ToolDefinition } from "./types";

/**
 * Build the complete tool and context block to append to any agent's system prompt.
 * This is the central infrastructure — every agent gets the same format,
 * the LLM decides what to use based on the agent's identity and the user's input.
 */
export function buildToolInstructions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return "";

  // Group tools by category for organized presentation
  const byCategory = new Map<string, ToolDefinition[]>();
  for (const tool of tools) {
    const cat = tool.category || "general";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(tool);
  }

  // Build the tool catalog — self-describing, no hardcoded guidance
  const toolCatalog = tools
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(([name, p]) => `      "${name}" (${p.type}${p.required ? ", required" : ""}): ${p.description}`)
        .join("\n");
      return `  - ${tool.name} [${tool.category}]\n    ${tool.description}\n    Parameters:\n${params}`;
    })
    .join("\n\n");

  // Category summary for the LLM's awareness
  const categorySummary = [...byCategory.entries()]
    .map(([cat, catTools]) => `  ${cat}: ${catTools.map((t) => t.name).join(", ")}`)
    .join("\n");

  return `
<tool_infrastructure>

You have access to real tools on our platform's central infrastructure. These tools perform actual computations, validate data, query knowledge bases, and check regulatory compliance. Use them to ground your analysis in facts — never fabricate data.

<tool_catalog>
${toolCatalog}
</tool_catalog>

<tool_categories>
${categorySummary}
</tool_categories>

<calling_protocol>
To call a tool, use this exact format:

|||TOOL_CALL|||
{"tool": "<tool_name>", "params": {<parameters>}}
|||END_TOOL_CALL|||

- Call ONE tool at a time, then wait for the result before proceeding
- You may call as many tools as needed — there is no fixed sequence
- Choose tools based on what the input requires, not a predetermined checklist
- After each tool result, reason about what you learned and what you still need
- When you have enough evidence to produce a confident analysis, write your final response
</calling_protocol>

<operating_principles>
- AUTONOMY: You decide which tools to call and in what order based on the input
- EVIDENCE-FIRST: Always gather data before making claims — use tools to verify
- EFFICIENCY: Don't call tools that aren't relevant to the current input
- COMPLETENESS: If a tool result raises new questions, investigate with another tool
- CONFIDENCE: Keep gathering evidence until you can make a well-supported recommendation
- TRACEABILITY: Every score and conclusion must trace back to tool results or input data
- NEVER fabricate tool results — if a tool returns unexpected data, report it honestly
</operating_principles>

</tool_infrastructure>
`;
}
