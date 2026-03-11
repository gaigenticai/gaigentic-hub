/**
 * Agentic Loop — Multi-step tool-calling orchestration.
 *
 * When an agent has tools configured, this replaces the single-shot LLM call.
 * Every action (tool call, reasoning, decision) is recorded as a step event
 * streamed to the client in real-time for full transparency.
 *
 * The loop:
 *   1. Sends messages to LLM (non-streaming)
 *   2. Parses response for |||TOOL_CALL||| blocks
 *   3. Executes tools, streams rich step events to client
 *   4. Appends results and loops (max iterations)
 *   5. Final response is streamed as token events
 */

import type { Env } from "./types";
import type { ChatMessage, ChatParams } from "./llm";
import type {
  ToolDefinition,
  ToolContext,
  ToolCall,
  ToolCallRecord,
  StepEvent,
  StepType,
} from "./tools/types";
import { getTool } from "./tools/registry";

const MAX_ITERATIONS = 8;
const LOOP_TIMEOUT_MS = 120_000; // 2 minutes total wall-clock for the whole loop
const TOOL_CALL_OPEN = "|||TOOL_CALL|||";
const TOOL_CALL_CLOSE = "|||END_TOOL_CALL|||";

interface AgenticLoopParams {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  toolContext: ToolContext;
  env: Env;
  provider: { chat(params: ChatParams): Promise<{ content: string }> };
  model: string;
  maxTokens: number;
  temperature: number;
}

/**
 * Parse tool calls from LLM response text.
 * Robust: handles exact markers, markers with spaces/pipes, and common LLM formatting issues.
 */
function parseToolCall(text: string): {
  toolCall: ToolCall | null;
  textBefore: string;
  textAfter: string;
} {
  // Strategy 1: Exact markers
  let openIdx = text.indexOf(TOOL_CALL_OPEN);
  let closeIdx = openIdx !== -1 ? text.indexOf(TOOL_CALL_CLOSE, openIdx + TOOL_CALL_OPEN.length) : -1;

  // Strategy 2: Fuzzy match — weaker models insert spaces, newlines, or use different casing
  if (openIdx === -1) {
    const fuzzyOpen = /\|{2,3}\s*TOOL_CALL\s*\|{2,3}/i;
    const fuzzyClose = /\|{2,3}\s*END_TOOL_CALL\s*\|{2,3}/i;
    const openMatch = fuzzyOpen.exec(text);
    if (openMatch) {
      openIdx = openMatch.index;
      const searchAfter = openIdx + openMatch[0].length;
      const closeMatch = fuzzyClose.exec(text.slice(searchAfter));
      if (closeMatch) {
        // Adjust closeIdx to be relative to full text
        closeIdx = searchAfter + closeMatch.index;
        // Extract JSON between the fuzzy markers
        const jsonStr = text.slice(searchAfter, closeIdx).trim();
        const textBefore = text.slice(0, openIdx).trim();
        const textAfter = text.slice(closeIdx + closeMatch[0].length).trim();

        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.tool && typeof parsed.tool === "string") {
            return {
              toolCall: { tool: parsed.tool, params: parsed.params || {} },
              textBefore,
              textAfter,
            };
          }
        } catch {
          // Try extracting JSON from within the text
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.tool && typeof parsed.tool === "string") {
                return {
                  toolCall: { tool: parsed.tool, params: parsed.params || {} },
                  textBefore,
                  textAfter,
                };
              }
            } catch { /* skip */ }
          }
        }
      }
    }
  }

  // Strategy 3: No markers at all — look for raw JSON with "tool" key (last resort for very weak models)
  if (openIdx === -1) {
    // Flexible: match any JSON object containing a "tool" key, including nested params
    const rawJsonMatch = text.match(/\{\s*"tool"\s*:\s*"[\w_]+"\s*,\s*"params"\s*:\s*\{[\s\S]*?\}\s*\}/);
    if (rawJsonMatch) {
      try {
        const parsed = JSON.parse(rawJsonMatch[0]);
        if (parsed.tool && typeof parsed.tool === "string") {
          const idx = text.indexOf(rawJsonMatch[0]);
          return {
            toolCall: { tool: parsed.tool, params: parsed.params || {} },
            textBefore: text.slice(0, idx).trim(),
            textAfter: text.slice(idx + rawJsonMatch[0].length).trim(),
          };
        }
      } catch { /* skip */ }
    }
  }

  if (openIdx === -1 || closeIdx === -1) {
    return { toolCall: null, textBefore: text, textAfter: "" };
  }

  // Exact marker extraction
  const jsonStart = openIdx + TOOL_CALL_OPEN.length;
  const jsonStr = text.slice(jsonStart, closeIdx).trim();
  const textBefore = text.slice(0, openIdx).trim();
  const textAfter = text.slice(closeIdx + TOOL_CALL_CLOSE.length).trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.tool && typeof parsed.tool === "string") {
      return {
        toolCall: { tool: parsed.tool, params: parsed.params || {} },
        textBefore,
        textAfter,
      };
    }
  } catch {
    // Try extracting JSON object from messy text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.tool && typeof parsed.tool === "string") {
          return {
            toolCall: { tool: parsed.tool, params: parsed.params || {} },
            textBefore,
            textAfter,
          };
        }
      } catch { /* skip */ }
    }
  }

  return { toolCall: null, textBefore: text, textAfter: "" };
}

// No hardcoded classification — tools declare their own stepType via ToolDefinition.stepType

/**
 * Emit a step event to the SSE stream.
 */
function emitStep(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: StepEvent,
): void {
  controller.enqueue(
    encoder.encode(`event: step\ndata: ${JSON.stringify(event)}\n\n`),
  );
}

/**
 * Run the agentic loop. Returns a ReadableStream with step + token SSE events.
 */
export function runAgenticLoop(params: AgenticLoopParams): ReadableStream {
  const {
    messages,
    tools,
    toolContext,
    env,
    provider,
    model,
    maxTokens,
    temperature,
  } = params;

  const encoder = new TextEncoder();
  const conversationMessages = [...messages];
  const allSteps: StepEvent[] = [];
  let stepCounter = 0;

  return new ReadableStream({
    async start(controller) {
      try {
        let iteration = 0;
        const loopStart = Date.now();

        while (iteration < MAX_ITERATIONS) {
          // Check wall-clock timeout
          if (Date.now() - loopStart > LOOP_TIMEOUT_MS) {
            stepCounter++;
            const timeoutStep: StepEvent = {
              step_type: "llm_reasoning",
              tool: "llm",
              label: "Time limit reached — generating final analysis",
              status: "completed",
              step: stepCounter,
              maxSteps: MAX_ITERATIONS * 2,
              summary: `Loop timeout after ${Math.round((Date.now() - loopStart) / 1000)}s`,
            };
            emitStep(controller, encoder, timeoutStep);
            allSteps.push({ ...timeoutStep });
            break;
          }

          iteration++;
          stepCounter++;

          // Step: LLM reasoning
          const reasoningStep: StepEvent = {
            step_type: "llm_reasoning",
            tool: "llm",
            label: iteration === 1
              ? "Analyzing input and planning approach"
              : `Reasoning with ${allSteps.filter((s) => s.status === "completed").length} tool results`,
            status: "running",
            step: stepCounter,
            maxSteps: MAX_ITERATIONS * 2,
          };
          emitStep(controller, encoder, reasoningStep);

          const llmStart = Date.now();
          const response = await provider.chat({
            model,
            messages: conversationMessages,
            max_tokens: maxTokens,
            temperature,
          });
          const llmDuration = Date.now() - llmStart;

          const responseText = response.content;
          const { toolCall, textBefore } = parseToolCall(responseText);

          // Complete reasoning step
          reasoningStep.status = "completed";
          reasoningStep.duration_ms = llmDuration;
          reasoningStep.summary = toolCall
            ? `Decided to use ${toolCall.tool}`
            : "Generated final analysis";
          reasoningStep.output_data = toolCall
            ? { next_action: `call ${toolCall.tool}`, reasoning_excerpt: textBefore.slice(0, 200) }
            : { action: "final_response", response_length: responseText.length };
          emitStep(controller, encoder, reasoningStep);
          allSteps.push({ ...reasoningStep });

          if (!toolCall) {
            // Check if the model WANTED to use tools but didn't format the call
            // (common with weaker models — they narrate "I will search..." instead of calling)
            const narratesToolIntent = /\b(i will|i'll|let me|proceeding|i'?m going to|starting by|first,? i)\b.{0,60}\b(search|retrieve|fetch|look up|query|check|analyze|use|call|verify|screen|assess|calculate)\b/i.test(responseText);
            const noToolCallsYet = allSteps.filter((s) => s.step_type !== "llm_reasoning").length === 0;
            if (narratesToolIntent && noToolCallsYet && iteration <= 3) {
              // Model described intent but didn't call a tool — nudge it (up to 3 tries)
              const exampleTool = tools[0]?.name || "web_search";
              const exampleParam = Object.keys(tools[0]?.parameters || {})[0] || "query";
              conversationMessages.push(
                { role: "assistant", content: responseText },
                {
                  role: "user",
                  content: `STOP. You described what you plan to do, but you did NOT actually call a tool. You MUST output a tool call block RIGHT NOW. Do not explain, do not plan — just call the tool.\n\nFormat:\n|||TOOL_CALL|||\n{"tool": "${exampleTool}", "params": {"${exampleParam}": "your value"}}\n|||END_TOOL_CALL|||\n\nAvailable tools: ${tools.map((t) => t.name).join(", ")}.\n\nOUTPUT THE TOOL CALL BLOCK NOW:`,
                },
              );
              continue;
            }

            // No tool call — this is the final response.
            // Emit decision step
            stepCounter++;
            const decisionStep: StepEvent = {
              step_type: "decision",
              tool: "final_output",
              label: "Compiling final analysis with visual blocks",
              status: "completed",
              step: stepCounter,
              maxSteps: MAX_ITERATIONS * 2,
              summary: `Final report generated (${responseText.length} chars)`,
              output_data: {
                has_kpi: responseText.includes("|||KPI|||"),
                has_chart: responseText.includes("|||CHART|||"),
                has_table: responseText.includes("|||TABLE|||"),
              },
            };
            emitStep(controller, encoder, decisionStep);
            allSteps.push({ ...decisionStep });

            // Stream as token events
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify({ text: responseText })}\n\n`,
              ),
            );
            break;
          }

          // Validate tool
          const toolDef = getTool(toolCall.tool);
          const isAllowed = tools.some((t) => t.name === toolCall.tool);

          if (!toolDef || !isAllowed) {
            conversationMessages.push(
              { role: "assistant", content: responseText },
              {
                role: "user",
                content: `Tool "${toolCall.tool}" is not available. Available tools: ${tools.map((t) => t.name).join(", ")}. Please use an available tool or provide your final analysis.`,
              },
            );
            continue;
          }

          // Step: Tool execution — stepType comes from the tool itself
          stepCounter++;
          const toolStep: StepEvent = {
            step_type: toolDef.stepType,
            tool: toolCall.tool,
            label: getToolLabel(toolCall.tool, toolCall.params),
            status: "running",
            step: stepCounter,
            maxSteps: MAX_ITERATIONS * 2,
            input_data: sanitizeForDisplay(toolCall.params),
          };
          emitStep(controller, encoder, toolStep);

          // Execute with per-tool timeout (30s max)
          const TOOL_TIMEOUT_MS = 30_000;
          const toolStart = Date.now();
          let result;
          try {
            result = await Promise.race([
              toolDef.execute(toolCall.params, env, toolContext),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Tool ${toolCall.tool} timed out after 30s`)), TOOL_TIMEOUT_MS),
              ),
            ]);
          } catch (err) {
            result = {
              success: false,
              data: null,
              summary: `Tool error: ${(err as Error).message}`,
            };
          }
          const toolDuration = Date.now() - toolStart;

          // Complete tool step
          toolStep.status = result.success ? "completed" : "error";
          toolStep.duration_ms = toolDuration;
          toolStep.summary = result.summary;
          toolStep.output_data = sanitizeForDisplay(
            typeof result.data === "object" && result.data !== null
              ? (result.data as Record<string, unknown>)
              : { result: result.data },
          );
          if (!result.success) {
            toolStep.error_message = result.summary;
          }
          emitStep(controller, encoder, toolStep);
          allSteps.push({ ...toolStep });

          // SPECIAL OVERRIDE: Agent Handoff
          if (toolCall.tool === "escalate_to_agent" && result.success) {
            // Emit handoff event so the client can automatically trigger the new agent
            controller.enqueue(
              encoder.encode(`event: handoff\ndata: ${JSON.stringify(result.data)}\n\n`),
            );
            // Close the stream immediately, halting current agent execution
            controller.enqueue(
              encoder.encode(`event: done\ndata: ${JSON.stringify({ provider: "agentic", model })}\n\n`),
            );
            controller.close();
            return; // Terminate loop
          }

          // Append to conversation
          conversationMessages.push(
            { role: "assistant", content: responseText },
            {
              role: "user",
              content: `Tool result for ${toolCall.tool}:\n${JSON.stringify(result.data, null, 2)}\n\nSummary: ${result.summary}\n\nContinue your analysis. You may call another tool or provide your final response with visual blocks.`,
            },
          );
        }

        // If we hit max iterations or timeout, force a final response
        const hitLimit = iteration >= MAX_ITERATIONS || Date.now() - loopStart > LOOP_TIMEOUT_MS;
        if (hitLimit && !allSteps.some((s) => s.step_type === "decision")) {
          stepCounter++;
          const forceStep: StepEvent = {
            step_type: "llm_reasoning",
            tool: "llm",
            label: "Generating final analysis (max tool calls reached)",
            status: "running",
            step: stepCounter,
            maxSteps: MAX_ITERATIONS * 2,
          };
          emitStep(controller, encoder, forceStep);

          const forceResponse = await provider.chat({
            model,
            messages: [
              ...conversationMessages,
              {
                role: "user",
                content:
                  "You have used all available tool calls. Please provide your final analysis now using the data you have gathered. Include visual blocks (KPI, charts, tables) as appropriate.",
              },
            ],
            max_tokens: maxTokens,
            temperature,
          });

          forceStep.status = "completed";
          forceStep.summary = "Forced final analysis after max iterations";
          emitStep(controller, encoder, forceStep);

          controller.enqueue(
            encoder.encode(
              `event: token\ndata: ${JSON.stringify({ text: forceResponse.content })}\n\n`,
            ),
          );
        }

        // Emit all steps as metadata for audit persistence
        if (allSteps.length > 0) {
          controller.enqueue(
            encoder.encode(
              `event: steps_complete\ndata: ${JSON.stringify({ steps: allSteps })}\n\n`,
            ),
          );
        }

        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ provider: "agentic", model })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Agentic loop failed";
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({ provider: "agentic", model })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });
}

/**
 * Get a human-readable label for a tool step.
 * Generic — reads tool name and params, no hardcoded per-tool logic.
 */
function getToolLabel(
  toolName: string,
  params: Record<string, unknown>,
): string {
  // Build label from the first string param value as context
  const firstParamValue = Object.values(params).find((v) => typeof v === "string") as string | undefined;
  const context = firstParamValue?.slice(0, 60) || "";
  const readableName = toolName.replace(/_/g, " ");
  return context ? `${readableName}: ${context}` : `Running ${readableName}`;
}

/**
 * Sanitize data for display — truncate large values, limit depth.
 */
function sanitizeForDisplay(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.length > 500) {
      result[key] = value.slice(0, 500) + "...";
    } else if (Array.isArray(value) && value.length > 10) {
      result[key] = [...value.slice(0, 10), `... +${value.length - 10} more`];
    } else {
      result[key] = value;
    }
  }
  return result;
}

export { type ToolCallRecord };
