/**
 * Data Validation Tool — Validate and analyze transaction data.
 * Card checks, structuring detection, velocity analysis, amount thresholds,
 * geographic risk, and temporal patterns.
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

// High-risk country codes (FATF grey/blacklist + common high-risk)
const HIGH_RISK_COUNTRIES = new Set([
  "IR", "KP", "MM", // FATF blacklist
  "BF", "CM", "CD", "HT", "KE", "ML", "MZ", "NA", "NG", "ZA", "SS", "SY", "TZ", "VE", "VN", "YE", // FATF greylist
  "AF", "IQ", "LY", "SO", "SD", // Additional high-risk
]);

const MODERATE_RISK_COUNTRIES = new Set([
  "AE", "PA", "KY", "BS", "BZ", "VG", "LB", "PK", "BD", "LK", "MN", "LA", "KH",
]);

// CTR thresholds by jurisdiction
const CTR_THRESHOLDS: Record<string, { amount: number; currency: string }> = {
  US: { amount: 10000, currency: "USD" },
  EU: { amount: 15000, currency: "EUR" },
  IN: { amount: 1000000, currency: "INR" },
  AE: { amount: 55000, currency: "AED" },
  UK: { amount: 10000, currency: "GBP" },
};

export const dataValidationTool: ToolDefinition = {
  name: "data_validation",
  description:
    "Validate and analyze data: card numbers (Luhn), structuring detection, velocity analysis, amount threshold checks, geographic risk assessment, and temporal pattern analysis. Essential for compliance checks.",
  parameters: {
    validation_type: {
      type: "string",
      description:
        '"card_number", "structuring_check", "velocity_analysis", "amount_threshold", "geographic_risk", "temporal_analysis", "date_range", "pattern"',
      required: true,
    },
    value: {
      type: "string",
      description: "Primary value to validate (amount, card number, country code, timestamp, etc.)",
      required: true,
    },
    rules: {
      type: "object",
      description:
        "Context data: {transactions_24h, transactions_7d, total_amount_24h, currency, customer_country, ip_country, transaction_type, prior_flags, etc.}",
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

      case "structuring_check": {
        const amount = parseFloat(value);
        if (isNaN(amount)) {
          return { success: false, data: null, summary: `Invalid amount: ${value}` };
        }
        const currency = (rules.currency as string) || "USD";
        const txCount24h = (rules.transactions_24h as number) || 0;
        const totalAmount24h = (rules.total_amount_24h as number) || 0;
        const txType = (rules.transaction_type as string) || "wire_transfer";

        // Determine applicable CTR threshold
        const jurisdiction = (rules.jurisdiction as string) || "US";
        const ctr = CTR_THRESHOLDS[jurisdiction] || CTR_THRESHOLDS.US;
        const threshold = ctr.amount;

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];
        let structuringScore = 0;

        // Check if amount is just below CTR threshold
        const percentOfThreshold = (amount / threshold) * 100;
        if (percentOfThreshold >= 80 && percentOfThreshold < 100) {
          const severity = percentOfThreshold >= 95 ? "CRITICAL" : percentOfThreshold >= 90 ? "HIGH" : "MEDIUM";
          const score = percentOfThreshold >= 95 ? 85 : percentOfThreshold >= 90 ? 70 : 50;
          signals.push({
            signal: "below_threshold",
            severity,
            detail: `Amount $${amount.toLocaleString()} is ${(100 - percentOfThreshold).toFixed(1)}% below ${currency} ${threshold.toLocaleString()} CTR threshold (${percentOfThreshold.toFixed(1)}% of threshold)`,
            score,
          });
          structuringScore = Math.max(structuringScore, score);
        }

        // Check cumulative 24h amount
        if (totalAmount24h > 0) {
          const cumulativeWithCurrent = totalAmount24h;
          if (cumulativeWithCurrent > threshold * 0.8) {
            signals.push({
              signal: "cumulative_exposure",
              severity: cumulativeWithCurrent > threshold ? "HIGH" : "MEDIUM",
              detail: `Cumulative 24h exposure: $${cumulativeWithCurrent.toLocaleString()} (${((cumulativeWithCurrent / threshold) * 100).toFixed(0)}% of CTR threshold)`,
              score: cumulativeWithCurrent > threshold ? 75 : 55,
            });
            structuringScore = Math.max(structuringScore, cumulativeWithCurrent > threshold ? 75 : 55);
          }
        }

        // Check multiple below-threshold transactions
        if (txCount24h >= 3 && percentOfThreshold >= 70) {
          signals.push({
            signal: "split_transactions",
            severity: txCount24h >= 5 ? "CRITICAL" : "HIGH",
            detail: `${txCount24h} transactions in 24h with individual amounts near threshold — potential split/smurf pattern`,
            score: txCount24h >= 5 ? 90 : 70,
          });
          structuringScore = Math.max(structuringScore, txCount24h >= 5 ? 90 : 70);
        }

        // Round number check
        if (amount >= 1000 && amount % 100 === 0) {
          signals.push({
            signal: "round_amount",
            severity: amount % 1000 === 0 ? "MEDIUM" : "LOW",
            detail: `Round amount ($${amount.toLocaleString()}) may indicate structuring or layering`,
            score: amount % 1000 === 0 ? 35 : 20,
          });
          structuringScore = Math.max(structuringScore, amount % 1000 === 0 ? 35 : 20);
        }

        const assessment = structuringScore >= 80 ? "CONFIRMED_PATTERN" :
          structuringScore >= 60 ? "PROBABLE_STRUCTURING" :
          structuringScore >= 40 ? "POSSIBLE_STRUCTURING" : "NO_PATTERN";

        return {
          success: true,
          data: {
            amount,
            threshold,
            currency,
            percent_of_threshold: Math.round(percentOfThreshold * 10) / 10,
            structuring_score: structuringScore,
            assessment,
            signals,
            recommendation: structuringScore >= 60 ? "ESCALATE — file SAR consideration" :
              structuringScore >= 40 ? "FLAG — monitor for pattern continuation" : "CLEAR — no structuring indicators",
          },
          summary: `Structuring analysis: ${assessment} (score ${structuringScore}/100). Amount $${amount.toLocaleString()} is ${percentOfThreshold.toFixed(1)}% of ${currency} ${threshold.toLocaleString()} CTR threshold. ${signals.length} signal(s) detected.`,
        };
      }

      case "velocity_analysis": {
        const txCount24h = parseInt(value) || 0;
        const txCount7d = (rules.transactions_7d as number) || 0;
        const totalAmount24h = (rules.total_amount_24h as number) || 0;
        const totalAmount7d = (rules.total_amount_7d as number) || 0;
        const limit24h = (rules.limit_24h as number) || 5;
        const limit7d = (rules.limit_7d as number) || 20;
        const priorFlags = (rules.prior_flags as number) || 0;

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];
        let velocityScore = 0;

        // 24h velocity check
        const velocity24hPct = (txCount24h / limit24h) * 100;
        if (velocity24hPct >= 80) {
          const severity = velocity24hPct >= 100 ? "HIGH" : "MEDIUM";
          const score = velocity24hPct >= 100 ? 75 : velocity24hPct >= 90 ? 55 : 40;
          signals.push({
            signal: "velocity_24h",
            severity,
            detail: `${txCount24h} transactions in 24h (${velocity24hPct.toFixed(0)}% of ${limit24h} limit)`,
            score,
          });
          velocityScore = Math.max(velocityScore, score);
        }

        // 7d velocity check
        const velocity7dPct = (txCount7d / limit7d) * 100;
        if (velocity7dPct >= 60) {
          const severity = velocity7dPct >= 100 ? "HIGH" : "MEDIUM";
          const score = velocity7dPct >= 100 ? 65 : velocity7dPct >= 80 ? 45 : 30;
          signals.push({
            signal: "velocity_7d",
            severity,
            detail: `${txCount7d} transactions in 7 days (${velocity7dPct.toFixed(0)}% of ${limit7d} limit)`,
            score,
          });
          velocityScore = Math.max(velocityScore, score);
        }

        // Amount acceleration
        if (totalAmount24h > 0 && totalAmount7d > 0) {
          const dailyAvg7d = totalAmount7d / 7;
          if (totalAmount24h > dailyAvg7d * 2) {
            const ratio = totalAmount24h / dailyAvg7d;
            signals.push({
              signal: "amount_acceleration",
              severity: ratio > 5 ? "HIGH" : "MEDIUM",
              detail: `24h total ($${totalAmount24h.toLocaleString()}) is ${ratio.toFixed(1)}x the 7-day daily average ($${dailyAvg7d.toLocaleString()})`,
              score: ratio > 5 ? 70 : ratio > 3 ? 50 : 35,
            });
            velocityScore = Math.max(velocityScore, ratio > 5 ? 70 : ratio > 3 ? 50 : 35);
          }
        }

        // Prior flags amplifier
        if (priorFlags > 0 && velocityScore > 0) {
          const amplifiedScore = Math.min(velocityScore + (priorFlags * 10), 100);
          signals.push({
            signal: "prior_flags_amplifier",
            severity: "HIGH",
            detail: `${priorFlags} prior flag(s) on account — velocity risk amplified`,
            score: priorFlags * 10,
          });
          velocityScore = amplifiedScore;
        }

        const assessment = velocityScore >= 70 ? "HIGH_VELOCITY" :
          velocityScore >= 40 ? "ELEVATED_VELOCITY" : "NORMAL_VELOCITY";

        return {
          success: true,
          data: {
            transactions_24h: txCount24h,
            transactions_7d: txCount7d,
            total_amount_24h: totalAmount24h,
            total_amount_7d: totalAmount7d,
            velocity_score: velocityScore,
            assessment,
            signals,
            thresholds: { limit_24h: limit24h, limit_7d: limit7d },
          },
          summary: `Velocity analysis: ${assessment} (score ${velocityScore}/100). ${txCount24h}/${limit24h} txns in 24h, ${txCount7d}/${limit7d} in 7d. ${signals.length} signal(s).`,
        };
      }

      case "amount_threshold": {
        const amount = parseFloat(value);
        if (isNaN(amount)) {
          return { success: false, data: null, summary: `Invalid amount: ${value}` };
        }

        const currency = (rules.currency as string) || "USD";
        const txType = (rules.transaction_type as string) || "wire_transfer";
        const jurisdiction = (rules.jurisdiction as string) || "US";

        // Type-specific thresholds
        const typeThresholds: Record<string, number> = {
          wire_transfer: 10000,
          international_transfer: 5000,
          p2p_transfer: 8000,
          card_payment: 15000,
          cash_withdrawal: 10000,
          cash_deposit: 10000,
        };

        const typeThreshold = typeThresholds[txType] || 10000;
        const ctrThreshold = (CTR_THRESHOLDS[jurisdiction] || CTR_THRESHOLDS.US).amount;

        const flags: string[] = [];
        let riskScore = 0;

        if (amount > ctrThreshold) {
          flags.push("exceeds_ctr_threshold");
          riskScore += 40;
        }
        if (amount > typeThreshold) {
          flags.push("exceeds_type_threshold");
          riskScore += 30;
        }
        if (amount > 50000) {
          flags.push("high_value");
          riskScore += 20;
        }
        if (amount > 5000 && amount % 1000 === 0) {
          flags.push("round_amount");
          riskScore += 10;
        }
        if (amount >= ctrThreshold * 0.9 && amount < ctrThreshold) {
          flags.push("near_ctr_threshold");
          riskScore += 35;
        }
        if (amount < 1) {
          flags.push("micro_transaction");
        }

        return {
          success: true,
          data: {
            amount,
            currency,
            transaction_type: txType,
            jurisdiction,
            ctr_threshold: ctrThreshold,
            type_threshold: typeThreshold,
            exceeds_ctr: amount > ctrThreshold,
            exceeds_type: amount > typeThreshold,
            near_threshold: amount >= ctrThreshold * 0.9 && amount < ctrThreshold,
            risk_score: Math.min(riskScore, 100),
            flags,
          },
          summary: `Amount $${amount.toLocaleString()} ${currency}: ${flags.length > 0 ? flags.join(", ") : "within normal range"} (risk score ${Math.min(riskScore, 100)}/100)`,
        };
      }

      case "geographic_risk": {
        const country = value.toUpperCase();
        const customerCountry = ((rules.customer_country as string) || "").toUpperCase();
        const ipCountry = ((rules.ip_country as string) || "").toUpperCase();
        const beneficiaryCountry = ((rules.beneficiary_country as string) || "").toUpperCase();

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];
        let geoScore = 0;

        // Country risk assessment
        if (HIGH_RISK_COUNTRIES.has(country) || HIGH_RISK_COUNTRIES.has(beneficiaryCountry)) {
          const riskCountry = HIGH_RISK_COUNTRIES.has(country) ? country : beneficiaryCountry;
          signals.push({
            signal: "high_risk_jurisdiction",
            severity: "CRITICAL",
            detail: `Transaction involves FATF grey/blacklist country: ${riskCountry}`,
            score: 85,
          });
          geoScore = Math.max(geoScore, 85);
        } else if (MODERATE_RISK_COUNTRIES.has(country) || MODERATE_RISK_COUNTRIES.has(beneficiaryCountry)) {
          const riskCountry = MODERATE_RISK_COUNTRIES.has(country) ? country : beneficiaryCountry;
          signals.push({
            signal: "moderate_risk_jurisdiction",
            severity: "MEDIUM",
            detail: `Transaction involves moderate-risk jurisdiction: ${riskCountry} (offshore/free zone)`,
            score: 45,
          });
          geoScore = Math.max(geoScore, 45);
        }

        // IP vs customer mismatch
        if (ipCountry && customerCountry && ipCountry !== customerCountry) {
          signals.push({
            signal: "ip_country_mismatch",
            severity: HIGH_RISK_COUNTRIES.has(ipCountry) ? "CRITICAL" : "HIGH",
            detail: `IP country (${ipCountry}) does not match customer country (${customerCountry})`,
            score: HIGH_RISK_COUNTRIES.has(ipCountry) ? 80 : 55,
          });
          geoScore = Math.max(geoScore, HIGH_RISK_COUNTRIES.has(ipCountry) ? 80 : 55);
        }

        // Cross-border assessment
        if (customerCountry && beneficiaryCountry && customerCountry !== beneficiaryCountry) {
          const isHighRiskCorridor =
            (HIGH_RISK_COUNTRIES.has(customerCountry) || HIGH_RISK_COUNTRIES.has(beneficiaryCountry));
          signals.push({
            signal: "cross_border",
            severity: isHighRiskCorridor ? "HIGH" : "LOW",
            detail: `Cross-border: ${customerCountry} → ${beneficiaryCountry}${isHighRiskCorridor ? " (high-risk corridor)" : ""}`,
            score: isHighRiskCorridor ? 65 : 20,
          });
          geoScore = Math.max(geoScore, isHighRiskCorridor ? 65 : 20);
        }

        const assessment = geoScore >= 70 ? "HIGH_RISK" :
          geoScore >= 40 ? "ELEVATED_RISK" :
          geoScore >= 20 ? "MODERATE_RISK" : "LOW_RISK";

        return {
          success: true,
          data: {
            country,
            customer_country: customerCountry,
            ip_country: ipCountry,
            beneficiary_country: beneficiaryCountry,
            geo_risk_score: geoScore,
            assessment,
            signals,
            high_risk_country: HIGH_RISK_COUNTRIES.has(country) || HIGH_RISK_COUNTRIES.has(beneficiaryCountry),
          },
          summary: `Geographic risk: ${assessment} (score ${geoScore}/100). ${signals.length} signal(s) for corridor ${customerCountry || country} → ${beneficiaryCountry || "domestic"}`,
        };
      }

      case "temporal_analysis": {
        const timestamp = value;
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
          return { success: false, data: null, summary: `Invalid timestamp: ${value}` };
        }

        const hour = date.getUTCHours();
        const dayOfWeek = date.getUTCDay(); // 0=Sunday
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isOffHours = hour >= 22 || hour < 6;
        const isLateNight = hour >= 1 && hour < 5;

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];
        let temporalScore = 0;

        if (isLateNight) {
          signals.push({
            signal: "late_night",
            severity: "HIGH",
            detail: `Transaction at ${hour}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC — late night hours (high risk)`,
            score: 55,
          });
          temporalScore = Math.max(temporalScore, 55);
        } else if (isOffHours) {
          signals.push({
            signal: "off_hours",
            severity: "MEDIUM",
            detail: `Transaction at ${hour}:${String(date.getUTCMinutes()).padStart(2, "0")} UTC — outside normal business hours`,
            score: 35,
          });
          temporalScore = Math.max(temporalScore, 35);
        }

        if (isWeekend) {
          signals.push({
            signal: "weekend",
            severity: "LOW",
            detail: `Transaction on ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek]}`,
            score: 15,
          });
          temporalScore = Math.max(temporalScore, Math.max(temporalScore, 15));
        }

        return {
          success: true,
          data: {
            timestamp,
            hour_utc: hour,
            day_of_week: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek],
            is_weekend: isWeekend,
            is_off_hours: isOffHours,
            temporal_score: temporalScore,
            signals,
          },
          summary: `Temporal analysis: ${isLateNight ? "Late night" : isOffHours ? "Off-hours" : "Normal hours"} transaction (score ${temporalScore}/100). ${date.toUTCString()}`,
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

      default:
        return {
          success: false,
          data: null,
          summary: `Unknown validation type: ${type}`,
        };
    }
  },
};
