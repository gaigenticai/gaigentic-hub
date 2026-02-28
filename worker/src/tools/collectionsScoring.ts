/**
 * Collections Scoring Tool — Delinquency analysis, recovery probability,
 * contact compliance, settlement calculation, and payment plan generation.
 * Production-grade analytics for debt collection agents.
 */

import type { ToolDefinition } from "./types";

// FDCPA call limits by state
const STATE_CALL_LIMITS: Record<string, { calls: number; days: number }> = {
  DEFAULT: { calls: 7, days: 7 },     // Federal: 7 calls per 7 days
  WA: { calls: 3, days: 7 },          // Washington
  MA: { calls: 2, days: 7 },          // Massachusetts
  NY: { calls: 4, days: 7 },          // New York
  CA: { calls: 5, days: 7 },          // California
};

// NPA classification (India)
const NPA_STAGES = {
  STANDARD: { dpd_min: 0, dpd_max: 29, provision: 0.4, label: "Standard" },
  SMA_0: { dpd_min: 0, dpd_max: 30, provision: 0.4, label: "Special Mention Account-0" },
  SMA_1: { dpd_min: 31, dpd_max: 60, provision: 5, label: "Special Mention Account-1" },
  SMA_2: { dpd_min: 61, dpd_max: 90, provision: 10, label: "Special Mention Account-2" },
  SUB_STANDARD: { dpd_min: 91, dpd_max: 365, provision: 15, label: "Sub-Standard" },
  DOUBTFUL_1: { dpd_min: 366, dpd_max: 730, provision: 25, label: "Doubtful-1" },
  DOUBTFUL_2: { dpd_min: 731, dpd_max: 1095, provision: 40, label: "Doubtful-2" },
  DOUBTFUL_3: { dpd_min: 1096, dpd_max: 999999, provision: 100, label: "Doubtful-3" },
  LOSS: { dpd_min: 999999, dpd_max: 999999, provision: 100, label: "Loss" },
};

// Recovery rate benchmarks by delinquency stage
const RECOVERY_BENCHMARKS: Record<string, number> = {
  early: 85,      // 1-30 DPD
  mid: 60,        // 31-60 DPD
  late: 35,       // 61-90 DPD
  npa: 18,        // 90+ DPD
  writeoff: 8,    // 180+ DPD
};

export const collectionsScoringTool: ToolDefinition = {
  name: "collections_scoring",
  description:
    "Comprehensive collections analytics: delinquency stage classification, propensity-to-pay scoring, contact compliance checks, settlement calculation, payment plan generation, and recovery strategy recommendation. Essential for debt collection and recovery agents.",
  category: "collections",
  stepType: "rule_check",
  parameters: {
    scoring_type: {
      type: "string",
      description:
        '"delinquency_classification", "propensity_to_pay", "contact_compliance", "settlement_calculation", "payment_plan", "recovery_strategy", "portfolio_risk"',
      required: true,
    },
    value: {
      type: "string",
      description: "Primary value (days past due, account balance, contact count, etc.)",
      required: true,
    },
    context: {
      type: "object",
      description:
        "Context: {outstanding_balance, original_amount, dpd, product_type, jurisdiction, state, contact_attempts_7d, last_contact_date, payment_history, credit_score, monthly_income, employment_status, promises_kept, promises_broken, partial_payments, hardship_flag}",
    },
  },
  async execute(params) {
    const type = params.scoring_type as string;
    const value = params.value as string;
    const ctx = (params.context as Record<string, unknown>) || {};

    switch (type) {
      case "delinquency_classification": {
        const dpd = parseInt(value) || 0;
        const outstandingBalance = (ctx.outstanding_balance as number) || 0;
        const originalAmount = (ctx.original_amount as number) || outstandingBalance;
        const productType = (ctx.product_type as string) || "personal_loan";
        const jurisdiction = (ctx.jurisdiction as string) || "US";

        // Determine stage
        let stage: string;
        let severity: string;
        let escalation: string;
        let recoveryBenchmark: number;

        if (dpd <= 0) {
          stage = "CURRENT"; severity = "NONE"; escalation = "No action required";
          recoveryBenchmark = 100;
        } else if (dpd <= 30) {
          stage = "EARLY_DELINQUENCY"; severity = "LOW";
          escalation = "Automated reminders — SMS, email, push notification";
          recoveryBenchmark = RECOVERY_BENCHMARKS.early;
        } else if (dpd <= 60) {
          stage = "MID_DELINQUENCY"; severity = "MEDIUM";
          escalation = "Increased outreach — phone calls, payment plan offers, hardship inquiry";
          recoveryBenchmark = RECOVERY_BENCHMARKS.mid;
        } else if (dpd <= 90) {
          stage = "LATE_DELINQUENCY"; severity = "HIGH";
          escalation = "Senior agent escalation — settlement offers, formal notices, restructuring";
          recoveryBenchmark = RECOVERY_BENCHMARKS.late;
        } else if (dpd <= 180) {
          stage = "NPA"; severity = "CRITICAL";
          escalation = "Legal notice, credit bureau reporting, external agency referral";
          recoveryBenchmark = RECOVERY_BENCHMARKS.npa;
        } else {
          stage = "WRITE_OFF_RISK"; severity = "CRITICAL";
          escalation = "Litigation review, asset research, debt sale consideration";
          recoveryBenchmark = RECOVERY_BENCHMARKS.writeoff;
        }

        // India NPA classification
        let npaClassification = null;
        if (jurisdiction === "IN") {
          for (const [key, npa] of Object.entries(NPA_STAGES)) {
            if (dpd >= npa.dpd_min && dpd <= npa.dpd_max) {
              npaClassification = { classification: key, label: npa.label, provision_percent: npa.provision, provision_amount: Math.round(outstandingBalance * npa.provision / 100) };
              break;
            }
          }
        }

        const estimatedRecovery = Math.round(outstandingBalance * recoveryBenchmark / 100);
        const expectedLoss = outstandingBalance - estimatedRecovery;

        // Aging bucket for portfolio view
        const agingBucket = dpd <= 0 ? "Current" : dpd <= 30 ? "1-30 DPD" : dpd <= 60 ? "31-60 DPD" : dpd <= 90 ? "61-90 DPD" : dpd <= 180 ? "91-180 DPD" : "180+ DPD";

        return {
          success: true,
          data: {
            dpd,
            stage,
            severity,
            aging_bucket: agingBucket,
            outstanding_balance: outstandingBalance,
            original_amount: originalAmount,
            recovery_benchmark_pct: recoveryBenchmark,
            estimated_recovery: estimatedRecovery,
            expected_loss: expectedLoss,
            escalation_action: escalation,
            product_type: productType,
            jurisdiction,
            npa_classification: npaClassification,
          },
          summary: `Delinquency: ${stage} (${dpd} DPD, ${severity}). Balance: ${outstandingBalance.toLocaleString()}. Recovery benchmark: ${recoveryBenchmark}%. Expected recovery: ${estimatedRecovery.toLocaleString()}.${npaClassification ? ` NPA: ${npaClassification.label} (${npaClassification.provision_percent}% provision)` : ""}`,
        };
      }

      case "propensity_to_pay": {
        const dpd = parseInt(value) || 0;
        const creditScore = (ctx.credit_score as number) || 0;
        const monthlyIncome = (ctx.monthly_income as number) || 0;
        const outstandingBalance = (ctx.outstanding_balance as number) || 0;
        const promisesKept = (ctx.promises_kept as number) || 0;
        const promisesBroken = (ctx.promises_broken as number) || 0;
        const partialPayments = (ctx.partial_payments as number) || 0;
        const employmentStatus = (ctx.employment_status as string) || "unknown";
        const hardshipFlag = (ctx.hardship_flag as boolean) || false;
        const contactResponseRate = (ctx.contact_response_rate as number); // 0-100%

        let propensityScore = 50; // Start neutral
        const signals: Array<{ signal: string; impact: string; detail: string; score_change: number }> = [];

        // DPD impact (higher DPD = lower propensity)
        if (dpd <= 30) {
          propensityScore += 20;
          signals.push({ signal: "early_delinquency", impact: "POSITIVE", detail: "Early stage — high recovery likelihood", score_change: 20 });
        } else if (dpd <= 60) {
          propensityScore += 5;
          signals.push({ signal: "mid_delinquency", impact: "NEUTRAL", detail: "Mid-stage delinquency", score_change: 5 });
        } else if (dpd <= 90) {
          propensityScore -= 10;
          signals.push({ signal: "late_delinquency", impact: "NEGATIVE", detail: "Late stage — recovery declining", score_change: -10 });
        } else {
          propensityScore -= 25;
          signals.push({ signal: "npa_stage", impact: "NEGATIVE", detail: `${dpd} DPD — significantly reduced recovery probability`, score_change: -25 });
        }

        // Credit score impact
        if (creditScore >= 700) {
          propensityScore += 15;
          signals.push({ signal: "good_credit", impact: "POSITIVE", detail: `Credit score ${creditScore} — indicates financial discipline`, score_change: 15 });
        } else if (creditScore >= 600) {
          propensityScore += 5;
        } else if (creditScore > 0 && creditScore < 550) {
          propensityScore -= 15;
          signals.push({ signal: "poor_credit", impact: "NEGATIVE", detail: `Credit score ${creditScore} — significant credit stress`, score_change: -15 });
        }

        // Promise behavior (strongest predictor)
        const totalPromises = promisesKept + promisesBroken;
        if (totalPromises > 0) {
          const keepRate = promisesKept / totalPromises;
          if (keepRate >= 0.7) {
            propensityScore += 20;
            signals.push({ signal: "reliable_promises", impact: "POSITIVE", detail: `${promisesKept}/${totalPromises} promises kept (${(keepRate * 100).toFixed(0)}%)`, score_change: 20 });
          } else if (keepRate < 0.3) {
            propensityScore -= 20;
            signals.push({ signal: "broken_promises", impact: "NEGATIVE", detail: `Only ${promisesKept}/${totalPromises} promises kept — unreliable`, score_change: -20 });
          }
        }

        // Partial payments (positive signal)
        if (partialPayments > 0) {
          propensityScore += 10;
          signals.push({ signal: "partial_payments", impact: "POSITIVE", detail: `${partialPayments} partial payment(s) — showing willingness`, score_change: 10 });
        }

        // Contact responsiveness
        if (contactResponseRate !== undefined) {
          if (contactResponseRate >= 60) {
            propensityScore += 10;
            signals.push({ signal: "responsive", impact: "POSITIVE", detail: `${contactResponseRate}% contact response rate`, score_change: 10 });
          } else if (contactResponseRate < 20) {
            propensityScore -= 15;
            signals.push({ signal: "unresponsive", impact: "NEGATIVE", detail: `Only ${contactResponseRate}% contact response rate`, score_change: -15 });
          }
        }

        // Employment status
        if (employmentStatus === "employed" || employmentStatus === "salaried") {
          propensityScore += 10;
          signals.push({ signal: "employed", impact: "POSITIVE", detail: "Active employment — income source confirmed", score_change: 10 });
        } else if (employmentStatus === "unemployed") {
          propensityScore -= 15;
          signals.push({ signal: "unemployed", impact: "NEGATIVE", detail: "Unemployed — limited repayment capacity", score_change: -15 });
        }

        // Hardship flag
        if (hardshipFlag) {
          propensityScore -= 5;
          signals.push({ signal: "hardship", impact: "NEUTRAL", detail: "Hardship flag — consider restructuring over aggressive collection", score_change: -5 });
        }

        // Balance vs income ratio
        if (monthlyIncome > 0) {
          const monthsToRepay = outstandingBalance / monthlyIncome;
          if (monthsToRepay > 12) {
            propensityScore -= 10;
            signals.push({ signal: "high_balance_ratio", impact: "NEGATIVE", detail: `Outstanding equals ${monthsToRepay.toFixed(1)} months' income`, score_change: -10 });
          }
        }

        // Clamp to 0-100
        propensityScore = Math.max(0, Math.min(100, propensityScore));

        const tier = propensityScore >= 70 ? "HIGH" :
          propensityScore >= 45 ? "MEDIUM" :
          propensityScore >= 25 ? "LOW" : "VERY_LOW";

        const recommendedAction = propensityScore >= 70 ? "Standard collection — payment reminder and gentle follow-up" :
          propensityScore >= 45 ? "Active outreach — payment plan offer, direct contact" :
          propensityScore >= 25 ? "Intensive — settlement offer, escalated contact, hardship review" :
          "Recovery action — legal review, external agency, debt restructuring";

        return {
          success: true,
          data: {
            propensity_score: propensityScore,
            tier,
            dpd,
            outstanding_balance: outstandingBalance,
            credit_score: creditScore || null,
            promises_kept: promisesKept,
            promises_broken: promisesBroken,
            employment_status: employmentStatus,
            hardship_flag: hardshipFlag,
            signals,
            recommended_action: recommendedAction,
          },
          summary: `Propensity to Pay: ${tier} (${propensityScore}/100). ${dpd} DPD, balance ${outstandingBalance.toLocaleString()}. ${signals.length} factor(s) analyzed. Action: ${recommendedAction.split(" — ")[0]}.`,
        };
      }

      case "contact_compliance": {
        const contactAttempts7d = parseInt(value) || 0;
        const jurisdiction = (ctx.jurisdiction as string) || "US";
        const state = (ctx.state as string) || "DEFAULT";
        const lastContactDate = (ctx.last_contact_date as string) || "";
        const currentHour = (ctx.current_hour as number) || new Date().getUTCHours();
        const contactChannel = (ctx.contact_channel as string) || "phone";
        const hasConsentSms = (ctx.has_consent_sms as boolean) || false;
        const hasCeaseRequest = (ctx.has_cease_request as boolean) || false;

        const violations: Array<{ rule: string; severity: string; detail: string; regulation: string }> = [];
        const clearances: string[] = [];
        let complianceScore = 100; // Start at 100, deduct for violations

        if (hasCeaseRequest) {
          violations.push({
            rule: "cease_communication",
            severity: "CRITICAL",
            detail: "Consumer has requested cease of communication — ALL contact prohibited",
            regulation: jurisdiction === "US" ? "FDCPA §805(c)" : "RBI Fair Practices Code",
          });
          complianceScore = 0;
        }

        // US-specific rules
        if (jurisdiction === "US") {
          // Call frequency limits
          const limits = STATE_CALL_LIMITS[state] || STATE_CALL_LIMITS.DEFAULT;
          if (contactAttempts7d >= limits.calls) {
            violations.push({
              rule: "call_frequency_exceeded",
              severity: "HIGH",
              detail: `${contactAttempts7d} calls in 7 days exceeds ${state === "DEFAULT" ? "federal" : state} limit of ${limits.calls}`,
              regulation: "Regulation F (12 CFR §1006.14)",
            });
            complianceScore -= 40;
          } else {
            clearances.push(`Call frequency OK: ${contactAttempts7d}/${limits.calls} in 7 days (${state === "DEFAULT" ? "Federal" : state} limit)`);
          }

          // Time window check (8 AM - 9 PM consumer local time)
          if (currentHour < 8 || currentHour >= 21) {
            violations.push({
              rule: "prohibited_hours",
              severity: "HIGH",
              detail: `Current hour ${currentHour}:00 — outside permitted window (8 AM - 9 PM)`,
              regulation: "FDCPA §805(a)(1)",
            });
            complianceScore -= 30;
          } else {
            clearances.push(`Time window OK: ${currentHour}:00 within 8 AM - 9 PM`);
          }

          // SMS consent
          if (contactChannel === "sms" && !hasConsentSms) {
            violations.push({
              rule: "sms_no_consent",
              severity: "HIGH",
              detail: "SMS contact requires prior express written consent under TCPA",
              regulation: "TCPA 47 USC §227",
            });
            complianceScore -= 30;
          }
        }

        // India-specific rules
        if (jurisdiction === "IN") {
          if (currentHour < 8 || currentHour >= 19) {
            violations.push({
              rule: "prohibited_hours_rbi",
              severity: "HIGH",
              detail: `Current hour ${currentHour}:00 — outside RBI permitted window (8 AM - 7 PM)`,
              regulation: "RBI Fair Practices Code",
            });
            complianceScore -= 30;
          } else {
            clearances.push(`Time window OK: ${currentHour}:00 within 8 AM - 7 PM (RBI)`);
          }
        }

        complianceScore = Math.max(0, complianceScore);
        const canContact = violations.length === 0;

        return {
          success: true,
          data: {
            can_contact: canContact,
            compliance_score: complianceScore,
            contact_attempts_7d: contactAttempts7d,
            jurisdiction,
            state: state !== "DEFAULT" ? state : null,
            current_hour: currentHour,
            contact_channel: contactChannel,
            violations,
            clearances,
            next_permitted_window: canContact ? null : jurisdiction === "IN" ? "8:00 AM - 7:00 PM" : "8:00 AM - 9:00 PM",
          },
          summary: `Contact Compliance: ${canContact ? "CLEARED" : "BLOCKED"} (score ${complianceScore}/100). ${violations.length} violation(s), ${clearances.length} clearance(s).${!canContact ? " DO NOT CONTACT." : ""}`,
        };
      }

      case "settlement_calculation": {
        const outstandingBalance = parseFloat(value);
        if (isNaN(outstandingBalance) || outstandingBalance <= 0) {
          return { success: false, data: null, summary: `Invalid balance: ${value}` };
        }

        const dpd = (ctx.dpd as number) || 0;
        const originalAmount = (ctx.original_amount as number) || outstandingBalance;
        const propensityScore = (ctx.propensity_score as number) || 50;
        const costToCollect = (ctx.cost_to_collect as number) || 0;
        const productType = (ctx.product_type as string) || "personal_loan";

        // Settlement discount based on DPD and propensity
        let baseDiscount: number;
        if (dpd <= 30) baseDiscount = 0;       // No settlement for early
        else if (dpd <= 60) baseDiscount = 5;
        else if (dpd <= 90) baseDiscount = 15;
        else if (dpd <= 180) baseDiscount = 25;
        else if (dpd <= 365) baseDiscount = 40;
        else baseDiscount = 55;

        // Adjust for propensity
        if (propensityScore >= 70) baseDiscount = Math.max(0, baseDiscount - 10); // High propensity = less discount needed
        if (propensityScore < 25) baseDiscount += 10; // Very low propensity = more discount to incentivize

        const minSettlement = Math.round(outstandingBalance * (100 - baseDiscount - 10) / 100);
        const recommendedSettlement = Math.round(outstandingBalance * (100 - baseDiscount) / 100);
        const maxSettlement = Math.round(outstandingBalance * (100 - Math.max(0, baseDiscount - 10)) / 100);

        // Recovery economics
        const recoveryBenchmark = dpd <= 30 ? 85 : dpd <= 60 ? 60 : dpd <= 90 ? 35 : dpd <= 180 ? 18 : 8;
        const expectedRecoveryNoSettlement = Math.round(outstandingBalance * recoveryBenchmark / 100);
        const settlementAdvantage = recommendedSettlement - expectedRecoveryNoSettlement;

        // NPV comparison (settlement now vs. extended collection)
        const monthsToRecover = dpd <= 90 ? 6 : 12;
        const discountRate = 0.01; // 1% monthly
        const npvSettlement = recommendedSettlement; // Immediate
        const npvCollection = Math.round(expectedRecoveryNoSettlement / Math.pow(1 + discountRate, monthsToRecover));

        return {
          success: true,
          data: {
            outstanding_balance: outstandingBalance,
            original_amount: originalAmount,
            dpd,
            settlement_range: { min: minSettlement, recommended: recommendedSettlement, max: maxSettlement },
            discount_percent: baseDiscount,
            recovery_benchmark_pct: recoveryBenchmark,
            expected_recovery_without_settlement: expectedRecoveryNoSettlement,
            settlement_advantage: settlementAdvantage,
            npv_comparison: { settlement_now: npvSettlement, extended_collection: npvCollection, better_option: npvSettlement >= npvCollection ? "settlement" : "collection" },
            cost_to_collect: costToCollect,
            net_recovery: recommendedSettlement - costToCollect,
          },
          summary: `Settlement: Recommended ${recommendedSettlement.toLocaleString()} (${baseDiscount}% discount) on ${outstandingBalance.toLocaleString()} balance. Range: ${minSettlement.toLocaleString()}-${maxSettlement.toLocaleString()}. Without settlement: ${expectedRecoveryNoSettlement.toLocaleString()} expected. NPV favors ${npvSettlement >= npvCollection ? "settlement" : "collection"}.`,
        };
      }

      case "payment_plan": {
        const outstandingBalance = parseFloat(value);
        if (isNaN(outstandingBalance) || outstandingBalance <= 0) {
          return { success: false, data: null, summary: `Invalid balance: ${value}` };
        }

        const monthlyIncome = (ctx.monthly_income as number) || 0;
        const existingEmi = (ctx.existing_emi as number) || 0;
        const dpd = (ctx.dpd as number) || 0;
        const hardshipFlag = (ctx.hardship_flag as boolean) || false;

        // Generate 3 plan options
        const plans: Array<{
          plan: string;
          installments: number;
          monthly_amount: number;
          total_payment: number;
          waiver_percent: number;
          suitable_for: string;
        }> = [];

        // Plan A: Aggressive (3-6 months)
        const aggressiveMonths = dpd > 90 ? 3 : 6;
        const aggressiveAmount = Math.round(outstandingBalance / aggressiveMonths);
        plans.push({
          plan: "Accelerated",
          installments: aggressiveMonths,
          monthly_amount: aggressiveAmount,
          total_payment: aggressiveAmount * aggressiveMonths,
          waiver_percent: dpd > 90 ? 10 : 5,
          suitable_for: "High income, wants quick resolution",
        });

        // Plan B: Standard (12 months)
        const standardMonths = 12;
        const standardAmount = Math.round(outstandingBalance / standardMonths);
        plans.push({
          plan: "Standard",
          installments: standardMonths,
          monthly_amount: standardAmount,
          total_payment: standardAmount * standardMonths,
          waiver_percent: dpd > 90 ? 5 : 0,
          suitable_for: "Moderate income, steady repayment capacity",
        });

        // Plan C: Extended / Hardship (18-24 months)
        const extendedMonths = hardshipFlag ? 24 : 18;
        const extendedAmount = Math.round(outstandingBalance * 0.95 / extendedMonths); // 5% waiver for extended
        plans.push({
          plan: hardshipFlag ? "Hardship" : "Extended",
          installments: extendedMonths,
          monthly_amount: extendedAmount,
          total_payment: extendedAmount * extendedMonths,
          waiver_percent: hardshipFlag ? 15 : 5,
          suitable_for: hardshipFlag ? "Documented financial hardship" : "Lower income, needs breathing room",
        });

        // Recommend based on income
        let recommended = "Standard";
        if (monthlyIncome > 0) {
          const affordableEmi = (monthlyIncome * 0.3) - existingEmi; // 30% of income for debt
          if (affordableEmi >= aggressiveAmount) recommended = "Accelerated";
          else if (affordableEmi < standardAmount) recommended = hardshipFlag ? "Hardship" : "Extended";
        }

        return {
          success: true,
          data: {
            outstanding_balance: outstandingBalance,
            dpd,
            monthly_income: monthlyIncome || null,
            hardship_flag: hardshipFlag,
            plans,
            recommended_plan: recommended,
            affordable_emi: monthlyIncome > 0 ? Math.round((monthlyIncome * 0.3) - existingEmi) : null,
          },
          summary: `Payment Plans for ${outstandingBalance.toLocaleString()}: ${plans.map(p => `${p.plan}: ${p.monthly_amount.toLocaleString()}/mo × ${p.installments}`).join(" | ")}. Recommended: ${recommended}.`,
        };
      }

      case "recovery_strategy": {
        const dpd = parseInt(value) || 0;
        const outstandingBalance = (ctx.outstanding_balance as number) || 0;
        const propensityScore = (ctx.propensity_score as number) || 50;
        const contactResponseRate = (ctx.contact_response_rate as number) || 50;
        const productType = (ctx.product_type as string) || "personal_loan";
        const jurisdiction = (ctx.jurisdiction as string) || "US";
        const hasCollateral = (ctx.has_collateral as boolean) || false;

        // Strategy determination matrix
        let primaryStrategy: string;
        let channels: string[];
        let tone: string;
        let frequency: string;
        let escalationTrigger: string;

        if (dpd <= 30) {
          primaryStrategy = "SOFT_REMINDER";
          channels = ["sms", "email", "push_notification"];
          tone = "Friendly, helpful";
          frequency = "Every 5 days";
          escalationTrigger = "No response after 3 attempts";
        } else if (dpd <= 60) {
          primaryStrategy = propensityScore >= 50 ? "ACTIVE_ENGAGEMENT" : "INTENSIVE_OUTREACH";
          channels = ["phone", "sms", "email"];
          tone = "Professional, empathetic";
          frequency = "Every 3 days";
          escalationTrigger = "No payment commitment after 5 attempts";
        } else if (dpd <= 90) {
          primaryStrategy = propensityScore >= 40 ? "PAYMENT_NEGOTIATION" : "SETTLEMENT_OFFER";
          channels = ["phone", "email", "letter"];
          tone = "Firm but fair";
          frequency = "Every 2 days";
          escalationTrigger = "Broken promise or non-response after 7 attempts";
        } else {
          primaryStrategy = hasCollateral ? "LEGAL_WITH_SECURITY" : (propensityScore >= 30 ? "RESTRUCTURE" : "EXTERNAL_RECOVERY");
          channels = ["phone", "registered_letter", "legal_notice"];
          tone = "Formal, compliance-focused";
          frequency = "Weekly";
          escalationTrigger = "Non-response after formal notice period";
        }

        const contactScript = dpd <= 30
          ? "This is a courtesy reminder about your upcoming/missed payment. We're here to help if you're facing any difficulties."
          : dpd <= 60
          ? "We noticed your account is past due. Would you like to discuss a payment arrangement that works for your situation?"
          : dpd <= 90
          ? "Your account requires immediate attention. We can offer a structured payment plan or discuss settlement options."
          : "This is a formal communication regarding your seriously delinquent account. Please contact us immediately to avoid further action.";

        const actions: string[] = [];
        if (dpd > 0) actions.push("Send payment reminder");
        if (dpd > 30) actions.push("Offer payment plan");
        if (dpd > 60) actions.push("Initiate settlement discussion");
        if (dpd > 90 && jurisdiction === "US") actions.push("Send validation notice (FDCPA §809)");
        if (dpd > 90 && jurisdiction === "IN") actions.push("Send demand notice per SARFAESI (if secured)");
        if (dpd > 120) actions.push("Credit bureau reporting");
        if (dpd > 180 && hasCollateral) actions.push("Initiate security enforcement");
        if (dpd > 180 && !hasCollateral) actions.push("Evaluate external agency referral or debt sale");

        return {
          success: true,
          data: {
            dpd,
            primary_strategy: primaryStrategy,
            channels,
            tone,
            contact_frequency: frequency,
            escalation_trigger: escalationTrigger,
            contact_script: contactScript,
            immediate_actions: actions,
            propensity_score: propensityScore,
            has_collateral: hasCollateral,
            jurisdiction,
          },
          summary: `Strategy: ${primaryStrategy} for ${dpd} DPD account. Channels: ${channels.join(", ")}. Tone: ${tone}. ${actions.length} action(s) recommended.`,
        };
      }

      case "portfolio_risk": {
        // Analyze a portfolio summary
        const totalAccounts = parseInt(value) || 0;
        const totalOutstanding = (ctx.total_outstanding as number) || 0;
        const dpd_0_30 = (ctx.dpd_0_30 as number) || 0;
        const dpd_31_60 = (ctx.dpd_31_60 as number) || 0;
        const dpd_61_90 = (ctx.dpd_61_90 as number) || 0;
        const dpd_90_plus = (ctx.dpd_90_plus as number) || 0;
        const amt_0_30 = (ctx.amt_0_30 as number) || 0;
        const amt_31_60 = (ctx.amt_31_60 as number) || 0;
        const amt_61_90 = (ctx.amt_61_90 as number) || 0;
        const amt_90_plus = (ctx.amt_90_plus as number) || 0;

        const delinquentAccounts = dpd_0_30 + dpd_31_60 + dpd_61_90 + dpd_90_plus;
        const delinquencyRate = totalAccounts > 0 ? Math.round((delinquentAccounts / totalAccounts) * 10000) / 100 : 0;

        const expectedRecovery =
          Math.round(amt_0_30 * 0.85) +
          Math.round(amt_31_60 * 0.60) +
          Math.round(amt_61_90 * 0.35) +
          Math.round(amt_90_plus * 0.15);

        const delinquentAmount = amt_0_30 + amt_31_60 + amt_61_90 + amt_90_plus;
        const expectedLoss = delinquentAmount - expectedRecovery;
        const portfolioRiskScore = totalOutstanding > 0
          ? Math.round((expectedLoss / totalOutstanding) * 10000) / 100
          : 0;

        return {
          success: true,
          data: {
            total_accounts: totalAccounts,
            total_outstanding: totalOutstanding,
            delinquent_accounts: delinquentAccounts,
            delinquency_rate: delinquencyRate,
            aging_distribution: {
              "1-30 DPD": { accounts: dpd_0_30, amount: amt_0_30, recovery_rate: 85 },
              "31-60 DPD": { accounts: dpd_31_60, amount: amt_31_60, recovery_rate: 60 },
              "61-90 DPD": { accounts: dpd_61_90, amount: amt_61_90, recovery_rate: 35 },
              "90+ DPD": { accounts: dpd_90_plus, amount: amt_90_plus, recovery_rate: 15 },
            },
            expected_recovery: expectedRecovery,
            expected_loss: expectedLoss,
            portfolio_risk_pct: portfolioRiskScore,
          },
          summary: `Portfolio: ${totalAccounts} accounts, ${delinquentAccounts} delinquent (${delinquencyRate}%). Outstanding: ${totalOutstanding.toLocaleString()}. Expected recovery: ${expectedRecovery.toLocaleString()}. Expected loss: ${expectedLoss.toLocaleString()} (${portfolioRiskScore}% risk).`,
        };
      }

      default:
        return {
          success: false,
          data: null,
          summary: `Unknown scoring type: ${type}`,
        };
    }
  },
};
