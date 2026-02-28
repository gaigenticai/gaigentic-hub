/**
 * Calculate Tool — Arithmetic, percentages, date calculations.
 */

import type { ToolDefinition } from "./types";

export const calculateTool: ToolDefinition = {
  name: "calculate",
  description:
    "Perform arithmetic calculations, percentage computations, date differences, and financial formulas. Use this for precise numerical analysis instead of mental math.",
  parameters: {
    expression: {
      type: "string",
      description:
        'Mathematical expression to evaluate, e.g. "2499 * 0.15", "(120 - 90) / 120 * 100"',
      required: true,
    },
    operation: {
      type: "string",
      description:
        'Optional named operation: "percentage", "date_diff", "compound", "ratio"',
    },
    values: {
      type: "object",
      description:
        "Optional named values for complex calculations, e.g. {amount: 2499, rate: 0.15}",
    },
  },
  async execute(params) {
    const expression = params.expression as string;
    const operation = params.operation as string | undefined;

    try {
      if (operation === "date_diff") {
        const values = params.values as { start: string; end: string } | undefined;
        if (!values?.start || !values?.end) {
          return { success: false, data: null, summary: "date_diff requires start and end dates" };
        }
        const start = new Date(values.start);
        const end = new Date(values.end);
        const diffMs = end.getTime() - start.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return {
          success: true,
          data: { days: diffDays, start: values.start, end: values.end },
          summary: `${diffDays} days between ${values.start} and ${values.end}`,
        };
      }

      // Safe expression evaluator (only allows numbers and basic operators)
      const sanitized = expression.replace(/[^0-9+\-*/.()% ]/g, "");
      if (sanitized !== expression.replace(/\s+/g, " ").trim().replace(/[^0-9+\-*/.()% ]/g, "")) {
        return { success: false, data: null, summary: "Invalid characters in expression" };
      }

      // Replace % with /100 for percentage handling
      const evalReady = sanitized.replace(/(\d+)%/g, "($1/100)");
      const result = Function(`"use strict"; return (${evalReady})`)();

      if (typeof result !== "number" || !isFinite(result)) {
        return { success: false, data: null, summary: "Expression did not produce a valid number" };
      }

      // Round to reasonable precision
      const rounded = Math.round(result * 10000) / 10000;

      return {
        success: true,
        data: { expression, result: rounded },
        summary: `${expression} = ${rounded}`,
      };
    } catch (err) {
      return {
        success: false,
        data: null,
        summary: `Calculation error: ${(err as Error).message}`,
      };
    }
  },
};
