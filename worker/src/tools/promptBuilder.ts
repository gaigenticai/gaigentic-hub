/**
 * Tool Prompt Builder — Generates system prompt instructions for tool usage.
 * Teaches the LLM the text-based tool calling protocol.
 */

import type { ToolDefinition } from "./types";

/**
 * Build the tool instructions block to append to the system prompt.
 * Only included when an agent has tools configured.
 */
export function buildToolInstructions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return "";

  const toolDocs = tools
    .map((tool) => {
      const paramLines = Object.entries(tool.parameters)
        .map(([name, param]) => {
          const req = param.required ? " (required)" : " (optional)";
          return `    - "${name}" (${param.type}${req}): ${param.description}`;
        })
        .join("\n");

      return `  ${tool.name}: ${tool.description}\n  Parameters:\n${paramLines}`;
    })
    .join("\n\n");

  return `
=== TOOL CALLING ===
You have access to the following tools. Use them to gather information, validate data, and perform calculations BEFORE writing your final analysis.

Available tools:
${toolDocs}

To call a tool, emit this exact block format:
|||TOOL_CALL|||
{"tool": "<tool_name>", "params": {<parameters as JSON>}}
|||END_TOOL_CALL|||

Rules for tool calling:
- Call ONE tool at a time, then wait for the result before proceeding
- After receiving tool results, you may call another tool or write your final response
- Use tools to gather real data — do NOT fabricate or assume information
- When you have enough information, write your final analysis with visual blocks
- You may call up to 5 tools per request
- Always include your reasoning about WHY you are calling each tool
=== END TOOL CALLING ===
`;
}
