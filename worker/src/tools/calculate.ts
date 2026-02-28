/**
 * Calculate Tool — Arithmetic, percentages, date calculations.
 * Uses a safe recursive descent parser (no eval/Function).
 */

import type { ToolDefinition } from "./types";

/**
 * Safe math expression parser — no eval(), no Function().
 * Supports: +, -, *, /, (), decimals, negative numbers, percentages.
 */
function parseMathExpression(expr: string): number {
  const tokens = tokenize(expr);
  let pos = 0;

  function peek(): string | null {
    return pos < tokens.length ? tokens[pos] : null;
  }
  function consume(): string {
    return tokens[pos++];
  }

  // Grammar: expr = term (('+' | '-') term)*
  function parseExpr(): number {
    let left = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = consume();
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  // term = factor (('*' | '/') factor)*
  function parseTerm(): number {
    let left = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = consume();
      const right = parseFactor();
      if (op === "/") {
        if (right === 0) throw new Error("Division by zero");
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  }

  // factor = number | '(' expr ')' | '-' factor
  function parseFactor(): number {
    const token = peek();
    if (token === "(") {
      consume(); // '('
      const val = parseExpr();
      if (peek() !== ")") throw new Error("Missing closing parenthesis");
      consume(); // ')'
      return val;
    }
    if (token === "-") {
      consume();
      return -parseFactor();
    }
    if (token !== null && /^\d/.test(token)) {
      const num = parseFloat(consume());
      // Check for trailing %
      if (peek() === "%") {
        consume();
        return num / 100;
      }
      return num;
    }
    throw new Error(`Unexpected token: ${token}`);
  }

  const result = parseExpr();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token: ${tokens[pos]}`);
  }
  return result;
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");

  while (i < s.length) {
    const ch = s[i];
    if ("+-*/()%".includes(ch)) {
      tokens.push(ch);
      i++;
    } else if (/\d/.test(ch) || ch === ".") {
      let num = "";
      while (i < s.length && (/\d/.test(s[i]) || s[i] === ".")) {
        num += s[i++];
      }
      tokens.push(num);
    } else {
      throw new Error(`Invalid character: ${ch}`);
    }
  }
  return tokens;
}

export const calculateTool: ToolDefinition = {
  name: "calculate",
  description:
    "Perform arithmetic calculations, percentage computations, date differences, and weighted scoring. Use this for precise numerical analysis instead of mental math.",
  category: "calculation",
  stepType: "tool_call",
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
        'Optional named operation: "percentage", "date_diff", "weighted_score", "ratio"',
    },
    values: {
      type: "object",
      description:
        'Named values for operations. For weighted_score: {scores: {dim1: 45, dim2: 85}, weights: {dim1: 0.20, dim2: 0.25}}. For date_diff: {start: "2026-01-01", end: "2026-02-28"}.',
    },
  },
  async execute(params) {
    const expression = params.expression as string;
    const operation = params.operation as string | undefined;
    const values = params.values as Record<string, unknown> | undefined;

    try {
      // Named operations
      if (operation === "date_diff") {
        const v = values as { start: string; end: string } | undefined;
        if (!v?.start || !v?.end) {
          return { success: false, data: null, summary: "date_diff requires start and end dates" };
        }
        const start = new Date(v.start);
        const end = new Date(v.end);
        const diffMs = end.getTime() - start.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        return {
          success: true,
          data: { days: diffDays, start: v.start, end: v.end },
          summary: `${diffDays} days between ${v.start} and ${v.end}`,
        };
      }

      if (operation === "weighted_score") {
        const scores = (values?.scores || {}) as Record<string, number>;
        const weights = (values?.weights || {}) as Record<string, number>;
        let weightedSum = 0;
        let totalWeight = 0;
        const breakdown: Array<{ dimension: string; score: number; weight: number; weighted: number }> = [];

        for (const [key, score] of Object.entries(scores)) {
          const weight = weights[key] || 0;
          const weighted = score * weight;
          weightedSum += weighted;
          totalWeight += weight;
          breakdown.push({ dimension: key, score, weight, weighted: Math.round(weighted * 100) / 100 });
        }

        const composite = Math.round(weightedSum * 100) / 100;
        return {
          success: true,
          data: { composite_score: composite, total_weight: totalWeight, breakdown },
          summary: `Weighted composite score: ${composite}/100 (${breakdown.map(b => `${b.dimension}: ${b.score}×${b.weight}=${b.weighted}`).join(", ")})`,
        };
      }

      // Sanitize — only allow numbers and basic math operators
      const cleaned = expression.replace(/\s+/g, "");
      if (!/^[0-9+\-*/.()%]+$/.test(cleaned)) {
        return { success: false, data: null, summary: "Invalid characters in expression — only numbers and +-*/()% allowed" };
      }

      const result = parseMathExpression(cleaned);

      if (!isFinite(result)) {
        return { success: false, data: null, summary: "Expression did not produce a valid number" };
      }

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
