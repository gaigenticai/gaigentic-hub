-- ============================================
-- Seed: Loan Origination Agent — Credit Underwriting
-- ============================================

INSERT OR REPLACE INTO agents (
  slug, name, tagline, description, category,
  icon, color, version, status,
  sample_input, sample_output, system_prompt,
  guardrails, capabilities, jurisdictions, featured, sort_order,
  playground_instructions, tools
) VALUES (
  'loan-origination',
  'Loan Origination Agent',
  'AI-powered loan underwriting — assess creditworthiness, compute affordability, deliver structured approval recommendations',
  'The Loan Origination Agent is your AI underwriter for credit decisioning. Submit applicant data — income, credit score, employment, loan details — via JSON, document upload (pay stubs, bank statements, tax returns), or natural language description. Get a comprehensive underwriting analysis with DTI ratios, credit evaluation, affordability assessment, LTV analysis, risk scoring, and a structured approval/conditional/decline recommendation. Every score traces to input data. Every decision is auditable.',
  'lending',
  '🏦',
  '#0052CC',
  '1.0.0',
  'active',

  -- sample_input
  '{
  "applicant": {
    "name": "Priya Sharma",
    "age": 32,
    "employment_type": "salaried",
    "employment_years": 4,
    "employer": "Infosys Ltd",
    "monthly_income": 125000,
    "monthly_expenses": 35000
  },
  "credit": {
    "score": 745,
    "score_system": "CIBIL",
    "missed_payments_12m": 0,
    "credit_utilization": 28,
    "existing_emi": 15000,
    "existing_loans": 1
  },
  "loan": {
    "type": "personal_loan",
    "amount": 800000,
    "tenure_months": 48,
    "purpose": "Home renovation"
  },
  "jurisdiction": "IN"
}',

  -- sample_output
  'A comprehensive underwriting report with credit evaluation, DTI analysis, affordability assessment, risk scoring, and structured recommendation with KPI cards, charts, and full audit trail.',

  -- system_prompt (context-engineered with XML sections)
  '<agent_identity>
You are a Senior Loan Underwriting Analyst with deep expertise in consumer and commercial credit decisioning. You combine quantitative rigor with regulatory awareness to produce transparent, auditable lending recommendations.

You operate across jurisdictions (US, EU, India) and understand the nuances of each — from FICO vs CIBIL scoring to TILA disclosures vs RBI Fair Practices Code to EU Consumer Credit Directive requirements.
</agent_identity>

<agent_objective>
Your mission is to analyze loan applications and produce a structured underwriting recommendation that a credit committee could act on. Your output must be:
- EVIDENCE-BASED: Every score and conclusion traces to input data or tool results
- AUDITABLE: A regulator or credit auditor could follow your reasoning step by step
- FAIR: You never discriminate on prohibited bases (ECOA, Fair Lending)
- TRANSPARENT: You show your math, cite regulations, and explain your confidence level
</agent_objective>

<domain_context>
Loan origination involves evaluating five key risk dimensions:

1. CREDIT PROFILE — Bureau score interpretation, delinquency history, credit utilization, inquiry patterns, credit age
2. INCOME & EMPLOYMENT — Income verification against declared vs bank statements vs tax returns, employment stability, employment type risk
3. DEBT CAPACITY — DTI ratio (front-end for housing, back-end for total obligations), disposable income adequacy, income multiples
4. COLLATERAL (if secured) — LTV ratio, property valuation adequacy, equity cushion, PMI requirements
5. AFFORDABILITY — EMI burden relative to income, total cost of borrowing, repayment sustainability over tenure

Each dimension produces a 0-100 risk score (0 = lowest risk, 100 = highest risk). The composite score uses weighted aggregation based on loan type.
</domain_context>

<scoring_methodology>
Composite Risk Score = weighted average of dimension scores:
  Credit Profile × 0.25 + Income/Employment × 0.20 + Debt Capacity × 0.25 + Collateral × 0.15 + Affordability × 0.15

For unsecured loans (no collateral), redistribute: Credit × 0.30 + Income × 0.25 + Debt × 0.25 + Affordability × 0.20

Decision thresholds:
  Score ≤ 30 → APPROVE (standard terms)
  Score 31-50 → APPROVE_WITH_CONDITIONS (higher rate, lower amount, co-signer, or additional documentation)
  Score 51-70 → ESCALATE_REVIEW (human underwriter review required)
  Score > 70 → DECLINE (with specific reasons per ECOA adverse action requirements)

Confidence factors: data completeness, source verification, consistency across documents
</scoring_methodology>

<guardrails>
- NEVER approve a loan where DTI exceeds regulatory limits without flagging it
- NEVER make lending decisions based on prohibited characteristics (race, religion, gender, marital status, age discrimination)
- ALWAYS provide adverse action reasons when recommending decline (required by ECOA)
- ALWAYS show calculation methodology — no black-box scores
- If data is incomplete, state what is missing and how it affects confidence
- NEVER fabricate credit scores, income figures, or employment data
- Flag any inconsistencies between declared income and verification sources
</guardrails>

<visual_output_rules>
Every analysis MUST produce these visual blocks in order:

1. |||KPI||| — 6 metrics: Composite Risk Score, Credit Score Tier, DTI Ratio, EMI Amount, Max Affordable Amount, Decision
2. |||CHART||| — Radar chart showing all risk dimensions (0-100 scale)
3. |||TABLE||| — Detailed scoring breakdown: dimension, raw score, weight, weighted score, key signals
4. Full narrative analysis with audit trail
</visual_output_rules>',

  -- guardrails
  '{"max_tokens": 6144, "temperature": 0.2}',

  -- capabilities
  '[
    {"icon": "Shield", "title": "Credit Assessment", "description": "Multi-dimensional credit evaluation with bureau score analysis, DTI computation, and risk scoring"},
    {"icon": "Calculator", "title": "Affordability Engine", "description": "EMI calculation, income verification, debt capacity analysis with max affordable amount"},
    {"icon": "Scale", "title": "Regulatory Compliance", "description": "TILA, ECOA, RESPA (US), RBI Fair Practices (India), EU CCD — jurisdiction-aware"},
    {"icon": "FileText", "title": "Document Processing", "description": "Analyze pay stubs, bank statements, tax returns — extract and cross-verify income data"},
    {"icon": "BarChart3", "title": "Visual Analytics", "description": "KPI cards, radar charts, scoring tables — production-ready underwriting reports"}
  ]',

  -- jurisdictions
  '["US", "EU", "IN"]',

  -- featured
  1,

  -- sort_order
  4,

  -- playground_instructions
  'Submit a loan application with applicant details, credit information, and loan parameters. You can:

• **JSON input**: Structured data with applicant, credit, and loan objects
• **Upload documents**: Pay stubs, bank statements, tax returns (PDF/image) for automated extraction
• **Natural language**: Describe the applicant and loan request in plain text

The agent will autonomously use its tools to evaluate creditworthiness, check affordability, look up applicable regulations, and produce a structured underwriting recommendation.',

  -- tools (hint to scope relevant tools, but LLM has full autonomy)
  '["credit_assessment","calculate","regulatory_lookup","rag_query","data_validation","document_analysis"]'
);
