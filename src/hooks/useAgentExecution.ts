import { useState, useRef, useCallback } from "react";
import type { VisualBlock, LLMProvider, AgentStep } from "../types";
import { executeAgent } from "../services/api";

// Visual block parser (mirrors server's visualEngine.ts)
const BLOCK_PATTERNS = [
  { type: "chart" as const, open: "|||CHART|||", close: "|||END_CHART|||" },
  { type: "table" as const, open: "|||TABLE|||", close: "|||END_TABLE|||" },
  { type: "kpi" as const, open: "|||KPI|||", close: "|||END_KPI|||" },
];

function parseVisualBlocks(rawText: string): VisualBlock[] {
  const blocks: VisualBlock[] = [];
  let remaining = rawText;

  while (remaining.length > 0) {
    let earliestIdx = remaining.length;
    let matchedPattern: (typeof BLOCK_PATTERNS)[0] | null = null;

    for (const pattern of BLOCK_PATTERNS) {
      const idx = remaining.indexOf(pattern.open);
      if (idx !== -1 && idx < earliestIdx) {
        earliestIdx = idx;
        matchedPattern = pattern;
      }
    }

    if (earliestIdx > 0) {
      const textContent = remaining.slice(0, earliestIdx).trim();
      if (textContent) blocks.push({ type: "text", content: textContent });
    }

    if (!matchedPattern) break;

    const openEnd = earliestIdx + matchedPattern.open.length;
    const closeIdx = remaining.indexOf(matchedPattern.close, openEnd);

    if (closeIdx === -1) {
      const textContent = remaining.slice(earliestIdx).trim();
      if (textContent) blocks.push({ type: "text", content: textContent });
      break;
    }

    const jsonStr = remaining.slice(openEnd, closeIdx).trim();
    try {
      blocks.push({ type: matchedPattern.type, content: JSON.parse(jsonStr) });
    } catch {
      blocks.push({ type: "text", content: jsonStr });
    }

    remaining = remaining.slice(closeIdx + matchedPattern.close.length);
  }

  return blocks;
}

/**
 * Buffered SSE parser — handles messages split across network chunks.
 * SSE messages are terminated by \n\n. We accumulate partial data in a buffer
 * and only parse complete messages.
 */
function createSSEParser() {
  let buffer = "";

  return function parseChunk(
    chunk: string,
  ): Array<{ event: string; data: string }> {
    buffer += chunk;
    const events: Array<{ event: string; data: string }> = [];

    // Split on double-newline (SSE message boundary)
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const message = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventType = "";
      let data = "";

      for (const line of message.split("\n")) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
      }

      if (data) {
        events.push({ event: eventType || "message", data });
      }

      boundary = buffer.indexOf("\n\n");
    }

    return events;
  };
}

export function useAgentExecution() {
  const [blocks, setBlocks] = useState<VisualBlock[]>([]);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditLogId, setAuditLogId] = useState<string | null>(null);
  const rawTextRef = useRef("");
  const abortRef = useRef<(() => void) | null>(null);
  const sseParserRef = useRef(createSSEParser());

  const execute = useCallback(
    async (
      agentSlug: string,
      input: Record<string, unknown>,
      options?: {
        provider?: LLMProvider;
        model?: string;
        userApiKey?: string;
        documentIds?: string[];
        prompt?: string;
      },
    ): Promise<{ auditLogId: string | null }> => {
      // Abort previous execution
      abortRef.current?.();

      setIsStreaming(true);
      setError(null);
      setBlocks([]);
      setSteps([]);
      setAuditLogId(null);
      rawTextRef.current = "";
      sseParserRef.current = createSSEParser();

      const { stream, abort, auditLogId: auditIdPromise } = executeAgent(agentSlug, input, options);
      abortRef.current = abort;

      // Resolve audit log ID when available
      auditIdPromise.then((id) => setAuditLogId(id));

      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const events = sseParserRef.current(value);
          for (const evt of events) {
            if (evt.event === "token") {
              try {
                const { text } = JSON.parse(evt.data);
                rawTextRef.current += text;
                setBlocks(parseVisualBlocks(rawTextRef.current));
              } catch {
                // Skip malformed event
              }
            } else if (evt.event === "step") {
              try {
                const step = JSON.parse(evt.data) as AgentStep;
                setSteps((prev) => {
                  // Update existing step or append new one
                  const existing = prev.findIndex(
                    (s) => s.step === step.step && s.tool === step.tool,
                  );
                  if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = step;
                    return updated;
                  }
                  return [...prev, step];
                });
              } catch {
                // Skip malformed step event
              }
            } else if (evt.event === "error") {
              try {
                const { error: errMsg } = JSON.parse(evt.data);
                setError(errMsg);
              } catch {
                setError("Execution failed");
              }
              // Mark any still-running steps as error
              setSteps((prev) =>
                prev.map((s) =>
                  s.status === "running" ? { ...s, status: "error" as const, error_message: "Request failed" } : s,
                ),
              );
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
        // Mark any still-running steps as error on stream failure
        setSteps((prev) =>
          prev.map((s) =>
            s.status === "running" ? { ...s, status: "error" as const, error_message: "Connection lost" } : s,
          ),
        );
      }

      setIsStreaming(false);
      const resolvedId = await auditIdPromise;
      return { auditLogId: resolvedId };
    },
    [],
  );

  const stop = useCallback(() => {
    abortRef.current?.();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.();
    setBlocks([]);
    setSteps([]);
    setError(null);
    setIsStreaming(false);
    rawTextRef.current = "";
  }, []);

  const getRawText = useCallback(() => rawTextRef.current, []);

  return { blocks, steps, isStreaming, error, auditLogId, execute, stop, reset, getRawText };
}
