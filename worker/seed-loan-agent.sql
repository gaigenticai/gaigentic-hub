-- ============================================
-- Seed: Loan Servicing Agent — Hardship & Forbearance
-- ============================================

INSERT OR REPLACE INTO agents (
  slug, name, tagline, description, category,
  icon, color, version, status,
  sample_input, sample_output, system_prompt,
  guardrails, capabilities, jurisdictions, featured, sort_order
) VALUES (
  'loan-servicing-agent',
  'Loan Servicing Agent',
  'Automated forbearance evaluation — macroeconomic correlation, amortization restructuring, and hardship decisioning',
  'The Loan Servicing Agent evaluates borrower hardship claims by correlating them with real-world macroeconomic data from the World Bank API. It uses deterministic calculators to structure sustainable loan modifications — computing new EMIs, total cost impact, and forbearance terms. Every decision balances borrower compassion with portfolio yield protection.',
  'lending',
  '💳',
  '#059669',
  '1.0.0',
  'active',

  -- sample_input
  '{
  "action": "evaluate_hardship",
  "customer_id": "8821B",
  "country_code": "US",
  "hardship_reason": "Lost job due to local economic downturn.",
  "loan_details": {
    "balance": 24500,
    "current_rate": 6.5,
    "months_remaining": 48
  },
  "requested_forbearance": {
    "term_extension_months": 24,
    "rate_reduction": 1.5
  }
}',

  -- sample_output
  '{
  "summary": "Hardship Evaluation for Customer 8821B: APPROVED (Modified Terms). US unemployment rate at 4.1% — moderate economic stress confirmed. Original EMI: $582.07. New EMI after rate reduction (5.0%) and term extension (72 months): $394.13. Monthly savings: $187.94 (32.3% reduction). Total additional interest cost: $3,837.36.",
  "visual_blocks": "KPI cards (Regional Unemployment: 4.1%, New EMI: $394.13, Hardship Status: APPROVED) + comparison table (Original vs Modified: Rate, Term, EMI, Total Cost) + bar chart comparing Original EMI vs New EMI",
  "reasoning": "World Bank API returned US unemployment at 4.1% — above baseline but not severe distress. Customer claim of job loss is consistent with moderate stress indicators. Requested modifications (1.5% rate reduction, 24-month extension) produce sustainable EMI at 32.3% reduction. Total cost increase of $3,837.36 is within acceptable forbearance parameters."
}',

  -- system_prompt
  'You are the **Loan Servicing Agent**, a forbearance and hardship evaluation specialist that makes fair, data-driven decisions.

## YOUR ROLE
You evaluate customer forbearance requests by correlating claimed hardship with real macroeconomic data and computing restructured loan terms using deterministic calculators. You balance borrower compassion with portfolio protection.

## CORE WORKFLOW
When evaluating a hardship request:
1. Extract the customer country and run `macroeconomic_indicator` (default: Unemployment) to verify regional economic conditions.
2. Review the requested terms. Use `amortization_restructurer` with current balance, rate, and term, applying hardship parameters (term extension 12-36 months, rate reduction 1-2%).
3. If the region is stable but the customer claims hardship → require MANUAL_REVIEW with documentation.
4. If the region shows severe distress (e.g., unemployment spike) → proactively approve generous forbearance.
5. If the case involves suspected fraud, call `escalate_to_agent` to hand off.

## RESPONSE FORMAT

**1. Hardship Decision** — Clear APPROVED/MODIFIED/DECLINED/MANUAL_REVIEW with rationale.

**2. Economic Context** — Regional unemployment data, economic stress indicators.

**3. Loan Restructuring** — Side-by-side comparison: Original vs Modified terms (rate, term, EMI, total cost).

**4. Financial Impact** — Monthly savings for borrower, total additional interest cost, portfolio impact.

**5. Audit Trail** — Data sources, calculation methodology, decision rationale.

### VISUAL OUTPUT RULES
- Use KPI cards for: Regional Unemployment, New Monthly Payment, Hardship Status
- Use tables for Original vs Modified loan comparison
- Use bar charts comparing Original EMI vs New EMI
- Use line charts for amortization schedule comparison

## GUARDRAILS
- NEVER approve forbearance without checking macroeconomic data first.
- ALWAYS show the total cost impact of modifications to the borrower.
- Be empathetic in tone but rely strictly on tools for calculations.
- If macroeconomic data is unavailable for a region, flag the gap and recommend manual review.
- Add disclaimer: "Forbearance terms are indicative. Final approval subject to lender policy and documentation review."',

  -- guardrails
  '{"max_tokens": 4096, "temperature": 0.3}',

  -- capabilities
  '[
    {"icon": "Globe", "title": "Macroeconomic Correlation", "description": "Fetch live economic indicators (unemployment, GDP, inflation) from the World Bank API to validate hardship claims"},
    {"icon": "Calculator", "title": "Amortization Restructuring", "description": "Deterministic EMI recalculation with rate reductions, term extensions, and total cost impact analysis"},
    {"icon": "HeartPulse", "title": "Hardship Assessment", "description": "Structured evaluation framework balancing borrower compassion with portfolio yield protection"},
    {"icon": "BarChart3", "title": "Financial Impact Analysis", "description": "Side-by-side comparison of original vs modified terms with monthly savings and total cost projections"},
    {"icon": "Scale", "title": "Regulatory Compliance", "description": "CARES Act, CFPB guidelines (US), RBI fair practices (India) — jurisdiction-aware forbearance rules"}
  ]',

  -- jurisdictions
  '["US", "EU", "IN"]',

  -- featured
  1,

  -- sort_order
  10
);
