/**
 * Visual Response Engine.
 * Parses LLM output into structured visual blocks (text, charts, tables, KPIs).
 * LLM is prompted to emit delimited blocks: |||CHART|||, |||TABLE|||, |||KPI|||
 */

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "area" | "radar";
  title: string;
  xKey: string;
  series: Array<{ dataKey: string; name: string; color: string }>;
  data: Array<Record<string, string | number>>;
}

export interface TableConfig {
  title: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number>>;
}

export interface KPIConfig {
  metrics: Array<{
    label: string;
    value: string;
    change?: string;
    trend?: "up" | "down" | "stable";
    description?: string;
  }>;
}

export interface VisualBlock {
  type: "text" | "chart" | "table" | "kpi";
  content: string | ChartConfig | TableConfig | KPIConfig;
}

const BLOCK_PATTERNS = [
  { type: "chart" as const, open: "|||CHART|||", close: "|||END_CHART|||" },
  { type: "table" as const, open: "|||TABLE|||", close: "|||END_TABLE|||" },
  { type: "kpi" as const, open: "|||KPI|||", close: "|||END_KPI|||" },
];

/**
 * Parse raw LLM text into an array of visual blocks.
 */
export function parseVisualBlocks(rawText: string): VisualBlock[] {
  const blocks: VisualBlock[] = [];
  let remaining = rawText;

  while (remaining.length > 0) {
    // Find the next visual block
    let earliestIdx = remaining.length;
    let matchedPattern: (typeof BLOCK_PATTERNS)[0] | null = null;

    for (const pattern of BLOCK_PATTERNS) {
      const idx = remaining.indexOf(pattern.open);
      if (idx !== -1 && idx < earliestIdx) {
        earliestIdx = idx;
        matchedPattern = pattern;
      }
    }

    // Text before the block
    if (earliestIdx > 0) {
      const textContent = remaining.slice(0, earliestIdx).trim();
      if (textContent) {
        blocks.push({ type: "text", content: textContent });
      }
    }

    // No more visual blocks
    if (!matchedPattern) break;

    // Extract visual block content
    const openEnd = earliestIdx + matchedPattern.open.length;
    const closeIdx = remaining.indexOf(matchedPattern.close, openEnd);

    if (closeIdx === -1) {
      // Unclosed block — treat rest as text
      const textContent = remaining.slice(earliestIdx).trim();
      if (textContent) {
        blocks.push({ type: "text", content: textContent });
      }
      break;
    }

    const jsonStr = remaining.slice(openEnd, closeIdx).trim();
    try {
      const parsed = JSON.parse(jsonStr);
      blocks.push({ type: matchedPattern.type, content: parsed });
    } catch {
      // Failed to parse — include as text
      blocks.push({ type: "text", content: jsonStr });
    }

    remaining = remaining.slice(closeIdx + matchedPattern.close.length);
  }

  return blocks;
}

/**
 * System prompt instructions appended to every agent prompt.
 * Teaches the LLM how to emit visual blocks.
 */
export const VISUAL_OUTPUT_INSTRUCTIONS = `
When your response includes quantitative data, metrics, or comparisons that would benefit from visualization, embed structured blocks using these exact delimiters:

For charts (bar, line, pie, area, radar):
|||CHART|||
{"type": "bar", "title": "Chart Title", "xKey": "name", "series": [{"dataKey": "value", "name": "Series Name", "color": "#6366f1"}], "data": [{"name": "Category A", "value": 30}, {"name": "Category B", "value": 70}]}
|||END_CHART|||

For data tables:
|||TABLE|||
{"title": "Table Title", "columns": [{"key": "col1", "label": "Column 1"}, {"key": "col2", "label": "Column 2"}], "rows": [{"col1": "value1", "col2": "value2"}]}
|||END_TABLE|||

For key metric cards (include "description" to explain how each value is calculated):
|||KPI|||
{"metrics": [{"label": "Metric Name", "value": "72", "change": "+3%", "trend": "up", "description": "How this metric was calculated and what it means"}, {"label": "Another Metric", "value": "84%", "change": "-1%", "trend": "down", "description": "Explanation of this metric's derivation"}]}
|||END_KPI|||

Rules:
- Always surround visual blocks with text explanation
- Use charts for trends and comparisons
- Use tables for detailed multi-column data
- Use KPI cards for key summary metrics (max 6)
- Ensure all JSON is valid and properly escaped
- If no data warrants visualization, respond with text only
`;
