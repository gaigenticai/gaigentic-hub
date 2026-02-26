import { useState, useRef, useCallback } from "react";
import type { VisualBlock, LLMProvider } from "../types";
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

function parseSSEEvents(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const lines = text.split("\n");
  let currentEvent = "";
  let currentData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7);
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6);
      events.push({ event: currentEvent || "message", data: currentData });
      currentEvent = "";
      currentData = "";
    }
  }

  return events;
}

export function useAgentExecution() {
  const [blocks, setBlocks] = useState<VisualBlock[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditLogId, setAuditLogId] = useState<string | null>(null);
  const rawTextRef = useRef("");
  const abortRef = useRef<(() => void) | null>(null);

  const execute = useCallback(
    async (
      agentSlug: string,
      input: Record<string, unknown>,
      options?: {
        provider?: LLMProvider;
        model?: string;
        userApiKey?: string;
        documentIds?: string[];
      },
    ): Promise<{ auditLogId: string | null }> => {
      // Abort previous execution
      abortRef.current?.();

      setIsStreaming(true);
      setError(null);
      setBlocks([]);
      setAuditLogId(null);
      rawTextRef.current = "";

      const { stream, abort, auditLogId: auditIdPromise } = executeAgent(agentSlug, input, options);
      abortRef.current = abort;

      // Resolve audit log ID when available
      auditIdPromise.then((id) => setAuditLogId(id));

      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const events = parseSSEEvents(value);
          for (const evt of events) {
            if (evt.event === "token") {
              try {
                const { text } = JSON.parse(evt.data);
                rawTextRef.current += text;
                setBlocks(parseVisualBlocks(rawTextRef.current));
              } catch {
                // Skip malformed event
              }
            } else if (evt.event === "error") {
              try {
                const { error: errMsg } = JSON.parse(evt.data);
                setError(errMsg);
              } catch {
                setError("Execution failed");
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
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
    setError(null);
    setIsStreaming(false);
    rawTextRef.current = "";
  }, []);

  return { blocks, isStreaming, error, auditLogId, execute, stop, reset };
}
