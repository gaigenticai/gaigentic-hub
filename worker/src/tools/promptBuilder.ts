/**
 * Tool Prompt Builder — Generates mandatory tool-calling workflow instructions.
 * Forces the LLM to use available tools BEFORE producing any final analysis.
 */

import type { ToolDefinition } from "./types";

/**
 * Build the tool instructions block to append to the system prompt.
 * The instructions MANDATE tool usage — the LLM must call tools before answering.
 */
export function buildToolInstructions(tools: ToolDefinition[], agentSlug?: string): string {
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

  // Get agent-specific mandatory workflow
  const workflow = getAgentWorkflow(agentSlug || "", tools);

  return `
=== MANDATORY TOOL-CALLING WORKFLOW ===

You are an agentic AI with access to real tools on our infrastructure. You MUST use these tools to gather data, validate inputs, and check regulations BEFORE writing your final analysis. DO NOT skip tools and answer from memory alone.

**CRITICAL RULES:**
1. You MUST call at least 2-3 tools before producing your final response
2. Call ONE tool at a time using the exact format below, then WAIT for the result
3. After receiving a tool result, reason about it, then call the NEXT tool
4. Only produce your final analysis (with visual blocks) AFTER you have gathered enough tool results
5. NEVER fabricate data — use tool results as the source of truth
6. Each tool call should have a clear purpose tied to your analysis

**Available tools on our infrastructure:**
${toolDocs}

**Tool calling format (use this EXACT syntax):**
I need to check [what you're checking]. Let me use the [tool_name] tool.

|||TOOL_CALL|||
{"tool": "<tool_name>", "params": {<parameters>}}
|||END_TOOL_CALL|||

${workflow}

**After gathering tool results, write your final analysis with visual blocks (|||KPI|||, |||CHART|||, |||TABLE|||).**
=== END TOOL-CALLING WORKFLOW ===
`;
}

/**
 * Get agent-specific mandatory workflow steps.
 */
function getAgentWorkflow(agentSlug: string, tools: ToolDefinition[]): string {
  const toolNames = tools.map((t) => t.name);

  if (agentSlug === "transaction-monitor") {
    const steps: string[] = [];
    steps.push("**MANDATORY ANALYSIS SEQUENCE for Transaction Monitoring:**");

    if (toolNames.includes("data_validation")) {
      steps.push('Step 1: Call `data_validation` with validation_type="amount_threshold" to check the transaction amount against CTR thresholds');
      steps.push('Step 2: Call `data_validation` with validation_type="structuring_check" to detect structuring patterns (include transactions_24h, total_amount_24h in rules)');
      steps.push('Step 3: Call `data_validation` with validation_type="velocity_analysis" to analyze transaction velocity (include transactions_7d, total_amount_7d in rules)');
      steps.push('Step 4: Call `data_validation` with validation_type="geographic_risk" to assess country risk (include customer_country, ip_country, beneficiary_country in rules)');
    }
    if (toolNames.includes("regulatory_lookup")) {
      steps.push('Step 5: Call `regulatory_lookup` to check applicable AML regulations for the jurisdiction (CTR/SAR thresholds, structuring laws, filing requirements)');
    }
    if (toolNames.includes("calculate")) {
      steps.push('Step 6: Call `calculate` to compute the weighted risk score using dimension scores from previous steps');
    }

    steps.push("");
    steps.push("After completing these steps, synthesize ALL tool results into your final analysis with visual blocks.");
    return steps.join("\n");
  }

  if (agentSlug === "chargeback-validity") {
    const steps: string[] = [];
    steps.push("**MANDATORY ANALYSIS SEQUENCE for Chargeback Analysis:**");

    if (toolNames.includes("data_validation")) {
      steps.push('Step 1: Call `data_validation` with validation_type="card_number" to validate the card (if BIN/card number provided)');
      steps.push('Step 2: Call `data_validation` with validation_type="amount_threshold" to check dispute amount thresholds');
      steps.push('Step 3: Call `data_validation` with validation_type="date_range" to check dispute filing deadlines');
    }
    if (toolNames.includes("regulatory_lookup")) {
      steps.push('Step 4: Call `regulatory_lookup` to check chargeback regulations and network rules for the jurisdiction');
    }
    if (toolNames.includes("rag_query")) {
      steps.push('Step 5: Call `rag_query` to search for relevant precedents and reason code guidance');
    }
    if (toolNames.includes("calculate")) {
      steps.push('Step 6: Call `calculate` to compute the composite risk score and expected value of representment');
    }

    steps.push("");
    steps.push("After completing these steps, synthesize ALL tool results into your final six-dimension analysis with visual blocks.");
    return steps.join("\n");
  }

  // Default workflow for any agent with tools
  const steps: string[] = [];
  steps.push("**RECOMMENDED WORKFLOW:**");

  if (toolNames.includes("rag_query")) {
    steps.push("Step 1: Call `rag_query` to search the knowledge base for relevant context");
  }
  if (toolNames.includes("data_validation")) {
    steps.push("Step 2: Call `data_validation` to validate key data points from the input");
  }
  if (toolNames.includes("regulatory_lookup")) {
    steps.push("Step 3: Call `regulatory_lookup` to check applicable regulations");
  }
  if (toolNames.includes("calculate")) {
    steps.push("Step 4: Call `calculate` to compute any required numerical analysis");
  }
  if (toolNames.includes("document_analysis")) {
    steps.push("Step 5: Call `document_analysis` if documents were uploaded");
  }

  steps.push("");
  steps.push("After gathering tool results, produce your final analysis with visual blocks.");
  return steps.join("\n");
}
