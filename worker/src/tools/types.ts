/**
 * Tool Framework — Type Definitions.
 * Tools are capabilities agents can invoke during multi-step reasoning.
 */

import type { Env } from "../types";

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "object";
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
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

export interface StepEvent {
  tool: string;
  label: string;
  status: "running" | "completed" | "error";
  step: number;
  maxSteps: number;
  summary?: string;
  duration_ms?: number;
}
