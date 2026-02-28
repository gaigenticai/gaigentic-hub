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
 */
function parseToolCall(text: string): {
  toolCall: ToolCall | null;
  textBefore: string;
  textAfter: string;
} {
  const openIdx = text.indexOf(TOOL_CALL_OPEN);
  if (openIdx === -1) {
    return { toolCall: null, textBefore: text, textAfter: "" };
  }

  const jsonStart = openIdx + TOOL_CALL_OPEN.length;
  const closeIdx = text.indexOf(TOOL_CALL_CLOSE, jsonStart);
  if (closeIdx === -1) {
    return { toolCall: null, textBefore: text, textAfter: "" };
  }

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
    // Invalid JSON
  }

  return { toolCall: null, textBefore: text, textAfter: "" };
}

/**
 * Classify which step type a tool belongs to.
 */
function classifyStepType(toolName: string): StepType {
  switch (toolName) {
    case "rag_query":
    case "regulatory_lookup":
      return "data_fetch";
    case "calculate":
      return "tool_call";
    case "data_validation":
      return "rule_check";
    case "document_analysis":
      return "data_fetch";
    default:
      return "tool_call";
  }
}

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

        while (iteration < MAX_ITERATIONS) {
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

          // Step: Tool execution
          stepCounter++;
          const toolStepType = classifyStepType(toolCall.tool);
          const toolStep: StepEvent = {
            step_type: toolStepType,
            tool: toolCall.tool,
            label: getToolLabel(toolCall.tool, toolCall.params),
            status: "running",
            step: stepCounter,
            maxSteps: MAX_ITERATIONS * 2,
            input_data: sanitizeForDisplay(toolCall.params),
          };
          emitStep(controller, encoder, toolStep);

          // Execute
          const toolStart = Date.now();
          let result;
          try {
            result = await toolDef.execute(toolCall.params, env, toolContext);
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

          // Append to conversation
          conversationMessages.push(
            { role: "assistant", content: responseText },
            {
              role: "user",
              content: `Tool result for ${toolCall.tool}:\n${JSON.stringify(result.data, null, 2)}\n\nSummary: ${result.summary}\n\nContinue your analysis. You may call another tool or provide your final response with visual blocks.`,
            },
          );
        }

        // If we hit max iterations, force a final response
        if (iteration >= MAX_ITERATIONS && !allSteps.some((s) => s.step_type === "decision")) {
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
 */
function getToolLabel(
  toolName: string,
  params: Record<string, unknown>,
): string {
  switch (toolName) {
    case "rag_query":
      return `Searching knowledge base: "${(params.query as string)?.slice(0, 60) || "..."}"`;
    case "calculate":
      return `Calculating: ${(params.expression as string)?.slice(0, 60) || "..."}`;
    case "data_validation":
      return `Validating ${params.validation_type || "data"}: ${(params.value as string)?.slice(0, 30) || "..."}`;
    case "document_analysis":
      return `Analyzing documents: ${params.action || "search"}`;
    case "regulatory_lookup":
      return `Looking up ${params.jurisdiction || ""} regulations: ${(params.topic as string)?.slice(0, 40) || "..."}`;
    default:
      return `Running ${toolName}`;
  }
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
