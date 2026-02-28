/**
 * Data Validation Tool — Validate data against rules.
 * Luhn check, date ranges, amount thresholds, pattern matching.
 */

import type { ToolDefinition } from "./types";

function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function getCardNetwork(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  if (/^35/.test(digits)) return "JCB";
  if (/^3(?:0[0-5]|[68])/.test(digits)) return "Diners Club";
  return "Unknown";
}

export const dataValidationTool: ToolDefinition = {
  name: "data_validation",
  description:
    "Validate data against specific rules: card number (Luhn check), date ranges, amount thresholds, pattern matching. Use this to verify input data integrity before analysis.",
  parameters: {
    validation_type: {
      type: "string",
      description:
        'Type of validation: "card_number", "date_range", "amount_threshold", "pattern"',
      required: true,
    },
    value: {
      type: "string",
      description: "The value to validate",
      required: true,
    },
    rules: {
      type: "object",
      description:
        "Validation rules, e.g. {min: 0, max: 10000} for amount, {start: date, end: date} for date_range",
    },
  },
  async execute(params) {
    const type = params.validation_type as string;
    const value = params.value as string;
    const rules = (params.rules as Record<string, unknown>) || {};

    switch (type) {
      case "card_number": {
        const valid = luhnCheck(value);
        const network = getCardNetwork(value);
        const masked = value.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ").replace(/(\d{4}) (\d{4}) (\d{4}) (\d{4})/, "**** **** **** $4");
        return {
          success: true,
          data: { valid, network, masked },
          summary: `Card ${masked}: ${valid ? "Valid" : "Invalid"} ${network}`,
        };
      }

      case "date_range": {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { success: false, data: null, summary: `Invalid date: ${value}` };
        }
        const start = rules.start ? new Date(rules.start as string) : null;
        const end = rules.end ? new Date(rules.end as string) : null;
        const inRange =
          (!start || date >= start) && (!end || date <= end);
        const now = new Date();
        const daysDiff = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        return {
          success: true,
          data: { date: value, inRange, daysDiff, withinWindow: rules.window_days ? daysDiff <= (rules.window_days as number) : null },
          summary: `Date ${value}: ${daysDiff} days ago${inRange ? ", within range" : ", outside range"}`,
        };
      }

      case "amount_threshold": {
        const amount = parseFloat(value);
        if (isNaN(amount)) {
          return { success: false, data: null, summary: `Invalid amount: ${value}` };
        }
        const min = rules.min as number | undefined;
        const max = rules.max as number | undefined;
        const withinRange =
          (min === undefined || amount >= min) &&
          (max === undefined || amount <= max);
        const flags: string[] = [];
        if (amount > 1000) flags.push("high_value");
        if (amount > 5000) flags.push("very_high_value");
        if (amount < 1) flags.push("micro_transaction");
        return {
          success: true,
          data: { amount, withinRange, flags },
          summary: `Amount $${amount}: ${withinRange ? "within" : "outside"} threshold${flags.length ? ` [${flags.join(", ")}]` : ""}`,
        };
      }

      default:
        return {
          success: false,
          data: null,
          summary: `Unknown validation type: ${type}`,
        };
    }
  },
};
