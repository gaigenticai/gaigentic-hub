/**
 * Tool Framework — Type Definitions.
 *
 * Tools are self-describing capabilities on the platform's central infrastructure.
 * Every agent has access to all tools. The LLM decides which tools to call
 * based on context and input — no hardcoded workflows.
 */

import type { Env } from "../types";

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object";
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  /** Unique tool identifier */
  name: string;
  /** What this tool does — presented directly to the LLM */
  description: string;
  /** Domain category — helps the LLM understand when this tool is relevant */
  category: "knowledge" | "calculation" | "validation" | "credit" | "collections" | "document" | "compliance";
  /** How this tool's execution should be classified in step events */
  stepType: StepType;
  /** Parameter schema — presented to the LLM as the calling interface */
  parameters: Record<string, ToolParameter>;
  /** Execute the tool */
  execute(
    params: Record<string, unknown>,
    env: Env,
    context: ToolContext,
  ): Promise<ToolResult>;
}

export interface ToolContext {
  agentId: string;
  agentSlug: string;
  documentContext?: string;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  summary: string;
}

export interface ToolCall {
  tool: string;
  params: Record<string, unknown>;
}

export interface ToolCallRecord {
  tool: string;
  params: Record<string, unknown>;
  result: ToolResult;
  duration_ms: number;
}

export type StepType = "tool_call" | "data_fetch" | "llm_reasoning" | "rule_check" | "decision";

export interface StepEvent {
  step_type: StepType;
  tool: string;
  label: string;
  status: "running" | "completed" | "error";
  step: number;
  maxSteps: number;
  summary?: string;
  duration_ms?: number;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
}
