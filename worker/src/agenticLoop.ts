/**
 * Agentic Loop — Multi-step tool-calling orchestration.
 *
 * When an agent has tools configured, this replaces the single-shot LLM call.
 * The loop:
 *   1. Sends messages to LLM (non-streaming)
 *   2. Parses response for |||TOOL_CALL||| blocks
 *   3. Executes tools, streams step events to client
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
} from "./tools/types";
import { getTool } from "./tools/registry";

const MAX_ITERATIONS = 5;
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
 * Returns the first tool call found (one at a time protocol).
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
        toolCall: {
          tool: parsed.tool,
          params: parsed.params || {},
        },
        textBefore,
        textAfter,
      };
    }
  } catch {
    // Invalid JSON — treat as text
  }

  return { toolCall: null, textBefore: text, textAfter: "" };
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
  const toolCallRecords: ToolCallRecord[] = [];

  return new ReadableStream({
    async start(controller) {
      try {
        let iteration = 0;

        while (iteration < MAX_ITERATIONS) {
          iteration++;

          // Call LLM (non-streaming to parse tool calls)
          const response = await provider.chat({
            model,
            messages: conversationMessages,
            max_tokens: maxTokens,
            temperature,
          });

          const responseText = response.content;

          // Check for tool call
          const { toolCall, textBefore, textAfter } = parseToolCall(responseText);

          if (!toolCall) {
            // No tool call — this is the final response.
            // Stream it as token events.
            controller.enqueue(
              encoder.encode(
                `event: token\ndata: ${JSON.stringify({ text: responseText })}\n\n`,
              ),
            );
            break;
          }

          // Validate tool exists and is allowed
          const toolDef = getTool(toolCall.tool);
          const isAllowed = tools.some((t) => t.name === toolCall.tool);

          if (!toolDef || !isAllowed) {
            // Tool not found — append error and continue
            conversationMessages.push(
              { role: "assistant", content: responseText },
              {
                role: "user",
                content: `Tool "${toolCall.tool}" is not available. Available tools: ${tools.map((t) => t.name).join(", ")}. Please use an available tool or provide your final analysis.`,
              },
            );
            continue;
          }

          // Emit step: running
          const stepEvent: StepEvent = {
            tool: toolCall.tool,
            label: getToolLabel(toolCall.tool, toolCall.params, "running"),
            status: "running",
            step: toolCallRecords.length + 1,
            maxSteps: MAX_ITERATIONS,
          };
          controller.enqueue(
            encoder.encode(
              `event: step\ndata: ${JSON.stringify(stepEvent)}\n\n`,
            ),
          );

          // Execute tool
          const startTime = Date.now();
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
          const duration = Date.now() - startTime;

          // Record for audit
          toolCallRecords.push({
            tool: toolCall.tool,
            params: toolCall.params,
            result,
            duration_ms: duration,
          });

          // Emit step: completed
          const completedStep: StepEvent = {
            tool: toolCall.tool,
            label: result.summary,
            status: result.success ? "completed" : "error",
            step: toolCallRecords.length,
            maxSteps: MAX_ITERATIONS,
            summary: result.summary,
            duration_ms: duration,
          };
          controller.enqueue(
            encoder.encode(
              `event: step\ndata: ${JSON.stringify(completedStep)}\n\n`,
            ),
          );

          // Append to conversation: assistant message (with tool call) + user message (with result)
          conversationMessages.push(
            { role: "assistant", content: responseText },
            {
              role: "user",
              content: `Tool result for ${toolCall.tool}:\n${JSON.stringify(result.data, null, 2)}\n\nSummary: ${result.summary}\n\nContinue your analysis. You may call another tool or provide your final response with visual blocks.`,
            },
          );
        }

        // If we hit max iterations without a final response, force one
        if (toolCallRecords.length >= MAX_ITERATIONS) {
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

          controller.enqueue(
            encoder.encode(
              `event: token\ndata: ${JSON.stringify({ text: forceResponse.content })}\n\n`,
            ),
          );
        }

        // Emit tool call records as metadata event
        if (toolCallRecords.length > 0) {
          controller.enqueue(
            encoder.encode(
              `event: tools\ndata: ${JSON.stringify({ calls: toolCallRecords.map((r) => ({ tool: r.tool, summary: r.result.summary, duration_ms: r.duration_ms })) })}\n\n`,
            ),
          );
        }

        // Done
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
  _status: "running" | "completed",
): string {
  switch (toolName) {
    case "rag_query":
      return `Searching knowledge base: "${(params.query as string)?.slice(0, 60) || "..."}"`;
    case "calculate":
      return `Calculating: ${(params.expression as string)?.slice(0, 60) || "..."}`;
    case "data_validation":
      return `Validating ${params.validation_type || "data"}`;
    case "document_analysis":
      return `Analyzing documents: ${params.action || "search"}`;
    case "regulatory_lookup":
      return `Looking up ${params.jurisdiction || ""} regulations: ${(params.topic as string)?.slice(0, 40) || "..."}`;
    default:
      return `Running ${toolName}`;
  }
}

/**
 * Get tool call records from the loop (for audit logging).
 * This is embedded in the stream as an event: tools event.
 */
export { type ToolCallRecord };
