/**
 * Credit Assessment Tool — Loan eligibility, DTI analysis, credit scoring,
 * affordability checks, and LTV calculations.
 * Production-grade underwriting analytics for loan origination agents.
 */

import type { ToolDefinition } from "./types";

// Credit score ranges by bureau system
const CREDIT_SCORE_RANGES: Record<string, { poor: number; fair: number; good: number; excellent: number }> = {
  FICO: { poor: 580, fair: 670, good: 740, excellent: 800 },
  CIBIL: { poor: 550, fair: 650, good: 750, excellent: 800 },
  SCHUFA: { poor: 80, fair: 90, good: 95, excellent: 97 }, // SCHUFA uses percentage
};

// Maximum DTI by loan type (industry standard)
const MAX_DTI_BY_LOAN_TYPE: Record<string, { front_end: number; back_end: number }> = {
  conventional_mortgage: { front_end: 28, back_end: 36 },
  fha_mortgage: { front_end: 31, back_end: 43 },
  va_mortgage: { front_end: 41, back_end: 41 },
  personal_loan: { front_end: 100, back_end: 40 },
  auto_loan: { front_end: 100, back_end: 45 },
  business_loan: { front_end: 100, back_end: 50 },
  credit_card: { front_end: 100, back_end: 35 },
  education_loan: { front_end: 100, back_end: 45 },
  bnpl: { front_end: 100, back_end: 50 },
};

// Interest rate benchmarks by credit tier (illustrative, for scoring)
const RATE_TIERS: Record<string, Record<string, { min: number; max: number }>> = {
  personal_loan: {
    excellent: { min: 6.5, max: 9.0 },
    good: { min: 9.0, max: 14.0 },
    fair: { min: 14.0, max: 22.0 },
    poor: { min: 22.0, max: 36.0 },
  },
  auto_loan: {
    excellent: { min: 4.0, max: 6.5 },
    good: { min: 6.5, max: 9.0 },
    fair: { min: 9.0, max: 14.0 },
    poor: { min: 14.0, max: 21.0 },
  },
  mortgage: {
    excellent: { min: 5.5, max: 6.5 },
    good: { min: 6.5, max: 7.5 },
    fair: { min: 7.5, max: 9.0 },
    poor: { min: 9.0, max: 12.0 },
  },
};

export const creditAssessmentTool: ToolDefinition = {
  name: "credit_assessment",
  description:
    "Comprehensive credit and loan assessment: DTI ratio analysis, credit score evaluation, loan affordability checks, LTV calculation, EMI computation, and risk tier classification. Essential for loan origination and underwriting decisions.",
  category: "credit",
  stepType: "rule_check",
  parameters: {
    assessment_type: {
      type: "string",
      description:
        '"dti_analysis", "credit_score_evaluation", "affordability_check", "ltv_calculation", "emi_calculation", "income_verification", "eligibility_check"',
      required: true,
    },
    value: {
      type: "string",
      description: "Primary value (income amount, credit score, loan amount, etc.)",
      required: true,
    },
    context: {
      type: "object",
      description:
        "Assessment context: {monthly_income, monthly_expenses, existing_emi, loan_amount, loan_tenure_months, interest_rate, property_value, credit_score, score_system, loan_type, employment_type, employment_years, jurisdiction}",
    },
  },
  async execute(params) {
    const type = params.assessment_type as string;
    const value = params.value as string;
    const ctx = (params.context as Record<string, unknown>) || {};

    switch (type) {
      case "dti_analysis": {
        const monthlyIncome = parseFloat(value);
        if (isNaN(monthlyIncome) || monthlyIncome <= 0) {
          return { success: false, data: null, summary: `Invalid monthly income: ${value}` };
        }

        const existingEmi = (ctx.existing_emi as number) || 0;
        const proposedEmi = (ctx.proposed_emi as number) || 0;
        const monthlyExpenses = (ctx.monthly_expenses as number) || 0;
        const loanType = (ctx.loan_type as string) || "personal_loan";
        const housingCost = (ctx.housing_cost as number) || 0;

        // Front-end DTI (housing only)
        const frontEndDTI = housingCost > 0
          ? Math.round(((housingCost + proposedEmi) / monthlyIncome) * 10000) / 100
          : 0;

        // Back-end DTI (all obligations)
        const totalObligations = existingEmi + proposedEmi;
        const backEndDTI = Math.round((totalObligations / monthlyIncome) * 10000) / 100;

        // Net disposable income
        const netDisposable = monthlyIncome - totalObligations - monthlyExpenses;
        const disposableRatio = Math.round((netDisposable / monthlyIncome) * 10000) / 100;

        // Get limits for loan type
        const limits = MAX_DTI_BY_LOAN_TYPE[loanType] || MAX_DTI_BY_LOAN_TYPE.personal_loan;

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];
        let dtiScore = 0; // 0 = best, 100 = worst

        // Back-end DTI scoring
        if (backEndDTI > limits.back_end) {
          signals.push({
            signal: "dti_exceeds_limit",
            severity: "CRITICAL",
            detail: `Back-end DTI ${backEndDTI}% exceeds ${loanType} limit of ${limits.back_end}%`,
            score: 90,
          });
          dtiScore = Math.max(dtiScore, 90);
        } else if (backEndDTI > limits.back_end * 0.9) {
          signals.push({
            signal: "dti_near_limit",
            severity: "HIGH",
            detail: `Back-end DTI ${backEndDTI}% is near ${loanType} limit of ${limits.back_end}%`,
            score: 65,
          });
          dtiScore = Math.max(dtiScore, 65);
        } else if (backEndDTI > limits.back_end * 0.7) {
          signals.push({
            signal: "dti_moderate",
            severity: "MEDIUM",
            detail: `Back-end DTI ${backEndDTI}% is moderate for ${loanType}`,
            score: 40,
          });
          dtiScore = Math.max(dtiScore, 40);
        }

        // Disposable income check
        if (netDisposable < 0) {
          signals.push({
            signal: "negative_disposable",
            severity: "CRITICAL",
            detail: `Negative disposable income: ${netDisposable.toLocaleString()} after obligations`,
            score: 95,
          });
          dtiScore = Math.max(dtiScore, 95);
        } else if (disposableRatio < 20) {
          signals.push({
            signal: "low_disposable",
            severity: "HIGH",
            detail: `Only ${disposableRatio}% disposable income remaining`,
            score: 60,
          });
          dtiScore = Math.max(dtiScore, 60);
        }

        const assessment = dtiScore >= 80 ? "UNACCEPTABLE" :
          dtiScore >= 60 ? "HIGH_RISK" :
          dtiScore >= 40 ? "MODERATE_RISK" : "ACCEPTABLE";

        return {
          success: true,
          data: {
            monthly_income: monthlyIncome,
            existing_obligations: existingEmi,
            proposed_emi: proposedEmi,
            total_obligations: totalObligations,
            front_end_dti: frontEndDTI,
            back_end_dti: backEndDTI,
            net_disposable: Math.round(netDisposable * 100) / 100,
            disposable_ratio: disposableRatio,
            limits: { front_end: limits.front_end, back_end: limits.back_end, loan_type: loanType },
            dti_risk_score: dtiScore,
            assessment,
            signals,
            recommendation: dtiScore >= 80 ? "DECLINE — DTI exceeds acceptable limits" :
              dtiScore >= 60 ? "CONDITIONAL — requires compensating factors or reduced amount" :
              dtiScore >= 40 ? "APPROVE_WITH_CONDITIONS — monitor repayment closely" : "APPROVE — healthy DTI ratio",
          },
          summary: `DTI Analysis: ${assessment} (risk ${dtiScore}/100). Back-end DTI: ${backEndDTI}% (limit: ${limits.back_end}%). Disposable: ${disposableRatio}%. ${signals.length} signal(s).`,
        };
      }

      case "credit_score_evaluation": {
        const score = parseFloat(value);
        if (isNaN(score)) {
          return { success: false, data: null, summary: `Invalid credit score: ${value}` };
        }

        const scoreSystem = (ctx.score_system as string) || "FICO";
        const ranges = CREDIT_SCORE_RANGES[scoreSystem] || CREDIT_SCORE_RANGES.FICO;
        const loanType = (ctx.loan_type as string) || "personal_loan";

        // Determine credit tier
        let tier: string;
        let tierScore: number; // 0 = best, 100 = worst
        if (score >= ranges.excellent) {
          tier = "EXCELLENT";
          tierScore = 10;
        } else if (score >= ranges.good) {
          tier = "GOOD";
          tierScore = 30;
        } else if (score >= ranges.fair) {
          tier = "FAIR";
          tierScore = 55;
        } else {
          tier = "POOR";
          tierScore = 85;
        }

        // Get rate estimate
        const loanCategory = loanType.includes("mortgage") ? "mortgage" :
          loanType.includes("auto") ? "auto_loan" : "personal_loan";
        const rates = RATE_TIERS[loanCategory];
        const applicableRate = rates?.[tier.toLowerCase()];

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];

        if (tier === "POOR") {
          signals.push({
            signal: "subprime_score",
            severity: "CRITICAL",
            detail: `${scoreSystem} score ${score} is below ${ranges.fair} — subprime classification`,
            score: 85,
          });
        }

        // Payment history factor
        const missedPayments = (ctx.missed_payments_12m as number) || 0;
        if (missedPayments > 0) {
          signals.push({
            signal: "recent_delinquency",
            severity: missedPayments >= 3 ? "CRITICAL" : missedPayments >= 2 ? "HIGH" : "MEDIUM",
            detail: `${missedPayments} missed payment(s) in last 12 months`,
            score: missedPayments >= 3 ? 80 : missedPayments >= 2 ? 60 : 40,
          });
          tierScore = Math.max(tierScore, missedPayments >= 3 ? 80 : 60);
        }

        // Credit utilization
        const utilization = (ctx.credit_utilization as number);
        if (utilization !== undefined) {
          if (utilization > 75) {
            signals.push({
              signal: "high_utilization",
              severity: "HIGH",
              detail: `Credit utilization at ${utilization}% — indicates credit stress`,
              score: 65,
            });
            tierScore = Math.max(tierScore, 65);
          } else if (utilization > 50) {
            signals.push({
              signal: "moderate_utilization",
              severity: "MEDIUM",
              detail: `Credit utilization at ${utilization}% — moderately high`,
              score: 40,
            });
          }
        }

        // Inquiries
        const recentInquiries = (ctx.recent_inquiries as number) || 0;
        if (recentInquiries >= 5) {
          signals.push({
            signal: "excessive_inquiries",
            severity: "HIGH",
            detail: `${recentInquiries} credit inquiries in recent period — credit-seeking behavior`,
            score: 50,
          });
          tierScore = Math.max(tierScore, 50);
        }

        return {
          success: true,
          data: {
            score,
            score_system: scoreSystem,
            tier,
            tier_risk_score: tierScore,
            rate_estimate: applicableRate || null,
            ranges: { poor: `< ${ranges.fair}`, fair: `${ranges.fair}-${ranges.good}`, good: `${ranges.good}-${ranges.excellent}`, excellent: `>= ${ranges.excellent}` },
            missed_payments_12m: missedPayments,
            credit_utilization: utilization || null,
            recent_inquiries: recentInquiries,
            signals,
            recommendation: tierScore >= 80 ? "DECLINE — credit profile too weak" :
              tierScore >= 55 ? "CONDITIONAL — higher rate, lower amount, or co-signer required" :
              tierScore >= 30 ? "APPROVE — standard terms with monitoring" : "APPROVE — preferred terms eligible",
          },
          summary: `Credit Evaluation: ${tier} (${scoreSystem} ${score}, risk ${tierScore}/100). ${applicableRate ? `Est. rate: ${applicableRate.min}-${applicableRate.max}%` : ""} ${signals.length} signal(s).`,
        };
      }

      case "affordability_check": {
        const loanAmount = parseFloat(value);
        if (isNaN(loanAmount) || loanAmount <= 0) {
          return { success: false, data: null, summary: `Invalid loan amount: ${value}` };
        }

        const monthlyIncome = (ctx.monthly_income as number) || 0;
        const interestRate = (ctx.interest_rate as number) || 12;
        const tenureMonths = (ctx.loan_tenure_months as number) || 60;
        const existingEmi = (ctx.existing_emi as number) || 0;
        const monthlyExpenses = (ctx.monthly_expenses as number) || 0;

        // EMI calculation: M = P * r * (1+r)^n / ((1+r)^n - 1)
        const monthlyRate = interestRate / 100 / 12;
        const emi = monthlyRate > 0
          ? Math.round(loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / (Math.pow(1 + monthlyRate, tenureMonths) - 1))
          : Math.round(loanAmount / tenureMonths);

        const totalRepayment = emi * tenureMonths;
        const totalInterest = totalRepayment - loanAmount;
        const totalObligations = existingEmi + emi;
        const netDisposable = monthlyIncome - totalObligations - monthlyExpenses;
        const dti = monthlyIncome > 0 ? Math.round((totalObligations / monthlyIncome) * 10000) / 100 : 100;
        const incomeMultiple = monthlyIncome > 0 ? Math.round((loanAmount / (monthlyIncome * 12)) * 100) / 100 : 0;

        // Affordability scoring
        let affordabilityScore = 0;
        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];

        if (netDisposable < 0) {
          signals.push({ signal: "cannot_afford", severity: "CRITICAL", detail: `Negative disposable: ${netDisposable.toLocaleString()}/month after EMI`, score: 95 });
          affordabilityScore = 95;
        } else if (dti > 50) {
          signals.push({ signal: "excessive_dti", severity: "CRITICAL", detail: `DTI ${dti}% exceeds safe limit with proposed EMI`, score: 85 });
          affordabilityScore = 85;
        } else if (dti > 40) {
          signals.push({ signal: "high_dti", severity: "HIGH", detail: `DTI ${dti}% is high — limited financial buffer`, score: 60 });
          affordabilityScore = 60;
        }

        if (incomeMultiple > 5) {
          signals.push({ signal: "high_income_multiple", severity: "HIGH", detail: `Loan is ${incomeMultiple}x annual income — elevated risk`, score: 55 });
          affordabilityScore = Math.max(affordabilityScore, 55);
        }

        // Max affordable amount (targeting 40% DTI)
        const maxEmi = (monthlyIncome * 0.4) - existingEmi;
        const maxAffordable = maxEmi > 0 && monthlyRate > 0
          ? Math.round(maxEmi * (Math.pow(1 + monthlyRate, tenureMonths) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)))
          : 0;

        const assessment = affordabilityScore >= 80 ? "UNAFFORDABLE" :
          affordabilityScore >= 55 ? "STRETCHED" :
          affordabilityScore >= 30 ? "MANAGEABLE" : "COMFORTABLE";

        return {
          success: true,
          data: {
            loan_amount: loanAmount,
            interest_rate: interestRate,
            tenure_months: tenureMonths,
            emi,
            total_repayment: totalRepayment,
            total_interest: totalInterest,
            dti_with_loan: dti,
            net_disposable: Math.round(netDisposable),
            income_multiple: incomeMultiple,
            max_affordable_amount: maxAffordable,
            affordability_score: affordabilityScore,
            assessment,
            signals,
          },
          summary: `Affordability: ${assessment} (risk ${affordabilityScore}/100). EMI: ${emi.toLocaleString()}/month. DTI with loan: ${dti}%. Max affordable: ${maxAffordable.toLocaleString()}. ${signals.length} signal(s).`,
        };
      }

      case "ltv_calculation": {
        const loanAmount = parseFloat(value);
        if (isNaN(loanAmount) || loanAmount <= 0) {
          return { success: false, data: null, summary: `Invalid loan amount: ${value}` };
        }

        const propertyValue = (ctx.property_value as number) || 0;
        if (propertyValue <= 0) {
          return { success: false, data: null, summary: "property_value is required for LTV calculation" };
        }

        const ltv = Math.round((loanAmount / propertyValue) * 10000) / 100;
        const loanType = (ctx.loan_type as string) || "conventional_mortgage";
        const jurisdiction = (ctx.jurisdiction as string) || "US";

        // LTV limits by type and jurisdiction
        const ltvLimits: Record<string, number> = {
          conventional_mortgage: jurisdiction === "IN" ? 80 : 80,
          fha_mortgage: 96.5,
          va_mortgage: 100,
          home_equity: 85,
          commercial: 75,
        };

        const maxLtv = ltvLimits[loanType] || 80;
        const pmiRequired = ltv > 80; // PMI typically required above 80% LTV

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];
        let ltvScore = 0;

        if (ltv > maxLtv) {
          signals.push({ signal: "ltv_exceeds_limit", severity: "CRITICAL", detail: `LTV ${ltv}% exceeds max ${maxLtv}% for ${loanType}`, score: 90 });
          ltvScore = 90;
        } else if (ltv > 90) {
          signals.push({ signal: "high_ltv", severity: "HIGH", detail: `LTV ${ltv}% — minimal equity cushion`, score: 70 });
          ltvScore = 70;
        } else if (ltv > 80) {
          signals.push({ signal: "above_80_ltv", severity: "MEDIUM", detail: `LTV ${ltv}% — PMI/insurance required`, score: 45 });
          ltvScore = 45;
        }

        const equity = propertyValue - loanAmount;
        const equityPercent = Math.round((equity / propertyValue) * 10000) / 100;

        return {
          success: true,
          data: {
            loan_amount: loanAmount,
            property_value: propertyValue,
            ltv,
            max_ltv: maxLtv,
            equity,
            equity_percent: equityPercent,
            pmi_required: pmiRequired,
            ltv_risk_score: ltvScore,
            signals,
            max_loan_at_limit: Math.round(propertyValue * maxLtv / 100),
          },
          summary: `LTV: ${ltv}% (limit: ${maxLtv}%). Equity: ${equityPercent}%. ${pmiRequired ? "PMI required." : ""} Risk: ${ltvScore}/100. ${signals.length} signal(s).`,
        };
      }

      case "emi_calculation": {
        const principal = parseFloat(value);
        if (isNaN(principal) || principal <= 0) {
          return { success: false, data: null, summary: `Invalid principal: ${value}` };
        }

        const rate = (ctx.interest_rate as number) || 12;
        const tenure = (ctx.loan_tenure_months as number) || 60;
        const monthlyRate = rate / 100 / 12;

        const emi = monthlyRate > 0
          ? Math.round(principal * monthlyRate * Math.pow(1 + monthlyRate, tenure) / (Math.pow(1 + monthlyRate, tenure) - 1))
          : Math.round(principal / tenure);

        const totalPayment = emi * tenure;
        const totalInterest = totalPayment - principal;
        const interestToLoanRatio = Math.round((totalInterest / principal) * 10000) / 100;

        // Amortization summary (first year and last year)
        const schedule = [];
        let balance = principal;
        for (let m = 1; m <= tenure; m++) {
          const interestPart = Math.round(balance * monthlyRate);
          const principalPart = emi - interestPart;
          balance = Math.max(balance - principalPart, 0);
          if (m <= 3 || m === tenure) {
            schedule.push({ month: m, emi, principal_part: principalPart, interest_part: interestPart, balance: Math.round(balance) });
          }
        }

        return {
          success: true,
          data: {
            principal,
            interest_rate: rate,
            tenure_months: tenure,
            emi,
            total_payment: totalPayment,
            total_interest: totalInterest,
            interest_to_loan_ratio: interestToLoanRatio,
            schedule_sample: schedule,
          },
          summary: `EMI: ${emi.toLocaleString()}/month for ${tenure} months at ${rate}%. Total repayment: ${totalPayment.toLocaleString()}. Interest: ${totalInterest.toLocaleString()} (${interestToLoanRatio}% of principal).`,
        };
      }

      case "income_verification": {
        const declaredIncome = parseFloat(value);
        if (isNaN(declaredIncome) || declaredIncome <= 0) {
          return { success: false, data: null, summary: `Invalid income: ${value}` };
        }

        const bankStatementAvg = (ctx.bank_statement_avg as number) || 0;
        const itrIncome = (ctx.itr_income as number) || 0;
        const employmentType = (ctx.employment_type as string) || "salaried";
        const employmentYears = (ctx.employment_years as number) || 0;

        const signals: Array<{ signal: string; severity: string; detail: string; score: number }> = [];
        let verificationScore = 0; // 0 = fully verified, 100 = unverifiable

        // Cross-reference income sources
        if (bankStatementAvg > 0) {
          const bankDiscrepancy = Math.abs(declaredIncome - bankStatementAvg) / declaredIncome * 100;
          if (bankDiscrepancy > 30) {
            signals.push({ signal: "income_discrepancy_bank", severity: "CRITICAL", detail: `Declared income differs from bank avg by ${bankDiscrepancy.toFixed(0)}%`, score: 80 });
            verificationScore = Math.max(verificationScore, 80);
          } else if (bankDiscrepancy > 15) {
            signals.push({ signal: "income_variance_bank", severity: "MEDIUM", detail: `${bankDiscrepancy.toFixed(0)}% variance between declared and bank statement average`, score: 40 });
            verificationScore = Math.max(verificationScore, 40);
          }
        } else {
          signals.push({ signal: "no_bank_verification", severity: "MEDIUM", detail: "No bank statement data for cross-verification", score: 35 });
          verificationScore = Math.max(verificationScore, 35);
        }

        if (itrIncome > 0) {
          const itrDiscrepancy = Math.abs(declaredIncome - itrIncome) / declaredIncome * 100;
          if (itrDiscrepancy > 25) {
            signals.push({ signal: "income_discrepancy_itr", severity: "HIGH", detail: `Declared income differs from ITR by ${itrDiscrepancy.toFixed(0)}%`, score: 65 });
            verificationScore = Math.max(verificationScore, 65);
          }
        }

        // Employment stability
        if (employmentYears < 1) {
          signals.push({ signal: "short_employment", severity: "HIGH", detail: `Only ${employmentYears} year(s) at current employer — income stability risk`, score: 55 });
          verificationScore = Math.max(verificationScore, 55);
        }

        if (employmentType === "self_employed" && !itrIncome) {
          signals.push({ signal: "self_employed_no_itr", severity: "HIGH", detail: "Self-employed applicant without ITR verification", score: 60 });
          verificationScore = Math.max(verificationScore, 60);
        }

        const assessment = verificationScore >= 70 ? "UNVERIFIED" :
          verificationScore >= 40 ? "PARTIALLY_VERIFIED" : "VERIFIED";

        return {
          success: true,
          data: {
            declared_income: declaredIncome,
            bank_statement_avg: bankStatementAvg || null,
            itr_income: itrIncome || null,
            employment_type: employmentType,
            employment_years: employmentYears,
            verification_score: verificationScore,
            assessment,
            signals,
          },
          summary: `Income verification: ${assessment} (risk ${verificationScore}/100). Declared: ${declaredIncome.toLocaleString()}${bankStatementAvg ? `, Bank avg: ${bankStatementAvg.toLocaleString()}` : ""}. ${signals.length} signal(s).`,
        };
      }

      case "eligibility_check": {
        const loanAmount = parseFloat(value);
        if (isNaN(loanAmount) || loanAmount <= 0) {
          return { success: false, data: null, summary: `Invalid loan amount: ${value}` };
        }

        const creditScore = (ctx.credit_score as number) || 0;
        const monthlyIncome = (ctx.monthly_income as number) || 0;
        const age = (ctx.age as number) || 0;
        const employmentType = (ctx.employment_type as string) || "salaried";
        const employmentYears = (ctx.employment_years as number) || 0;
        const loanType = (ctx.loan_type as string) || "personal_loan";
        const existingLoans = (ctx.existing_loans as number) || 0;
        const jurisdiction = (ctx.jurisdiction as string) || "US";

        const disqualifiers: string[] = [];
        const conditions: string[] = [];
        const passes: string[] = [];

        // Age check
        const minAge = jurisdiction === "IN" ? 21 : 18;
        const maxAge = loanType.includes("mortgage") ? 65 : 60;
        if (age > 0 && age < minAge) disqualifiers.push(`Below minimum age (${minAge})`);
        else if (age > maxAge) disqualifiers.push(`Above maximum age (${maxAge}) for ${loanType}`);
        else if (age > 0) passes.push(`Age ${age} — within eligibility range`);

        // Credit score check
        const minScore = loanType === "fha_mortgage" ? 580 :
          loanType.includes("mortgage") ? 620 : 550;
        if (creditScore > 0 && creditScore < minScore) disqualifiers.push(`Credit score ${creditScore} below minimum ${minScore} for ${loanType}`);
        else if (creditScore > 0) passes.push(`Credit score ${creditScore} meets minimum ${minScore}`);

        // Income check
        if (monthlyIncome > 0) {
          const annualIncome = monthlyIncome * 12;
          const incomeMultiple = loanAmount / annualIncome;
          if (incomeMultiple > 8) disqualifiers.push(`Loan ${incomeMultiple.toFixed(1)}x annual income — exceeds max 8x`);
          else if (incomeMultiple > 5) conditions.push(`Loan ${incomeMultiple.toFixed(1)}x annual income — high, compensating factors needed`);
          else passes.push(`Income multiple ${incomeMultiple.toFixed(1)}x — within range`);
        }

        // Employment check
        const minEmployment = employmentType === "self_employed" ? 2 : 1;
        if (employmentYears > 0 && employmentYears < minEmployment) {
          conditions.push(`${employmentYears} year(s) employment — minimum ${minEmployment} for ${employmentType}`);
        } else if (employmentYears > 0) {
          passes.push(`${employmentYears} years employment — meets minimum`);
        }

        // Existing loan burden
        if (existingLoans >= 4) conditions.push(`${existingLoans} existing loans — heavy debt burden`);

        const eligible = disqualifiers.length === 0;
        const eligibilityScore = disqualifiers.length > 0 ? 90 :
          conditions.length > 0 ? 50 : 15;

        return {
          success: true,
          data: {
            loan_amount: loanAmount,
            loan_type: loanType,
            jurisdiction,
            eligible,
            disqualifiers,
            conditions,
            passes,
            eligibility_score: eligibilityScore,
            criteria_checked: disqualifiers.length + conditions.length + passes.length,
          },
          summary: `Eligibility: ${eligible ? (conditions.length > 0 ? "CONDITIONAL" : "ELIGIBLE") : "INELIGIBLE"}. ${disqualifiers.length} disqualifier(s), ${conditions.length} condition(s), ${passes.length} pass(es).`,
        };
      }

      default:
        return {
          success: false,
          data: null,
          summary: `Unknown assessment type: ${type}`,
        };
    }
  },
};
