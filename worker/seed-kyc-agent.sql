-- ============================================
-- Seed: KYC/KYB Agent — Entity Onboarding
-- ============================================

INSERT OR REPLACE INTO agents (
  slug, name, tagline, description, category,
  icon, color, version, status,
  sample_input, sample_output, system_prompt,
  guardrails, capabilities, jurisdictions, featured, sort_order
) VALUES (
  'kyc-kyb-agent',
  'Entity Onboarding Agent',
  'Automated KYC/KYB verification — SEC EDGAR queries, sanctions screening, and compliance decisioning',
  'The Entity Onboarding Agent processes KYC/KYB applications by querying live SEC EDGAR records and global sanction lists (OFAC, UN, EU). It verifies corporate registrations, screens against sanctions databases, and delivers structured APPROVED/DECLINED/MANUAL_REVIEW decisions with full compliance audit trails.',
  'compliance',
  '👤',
  '#3B82F6',
  '1.0.0',
  'active',

  -- sample_input
  '{
  "action": "verify_entity",
  "entity_name": "Apple Inc",
  "ticker_symbol": "AAPL",
  "entity_type": "company",
  "incorporation_state_claimed": "CA",
  "industry": "Consumer Electronics"
}',

  -- sample_output
  '{
  "summary": "Entity Verification for Apple Inc (AAPL): APPROVED. SEC EDGAR confirms active registration (CIK: 0000320193, State: CA). Zero matches on OFAC, UN, and EU sanction lists. Entity is cleared for onboarding.",
  "visual_blocks": "KPI cards (EDGAR Status: REGISTERED, Sanction Matches: 0, Decision: APPROVED) + entity details table (CIK, State, SIC code, filing status) + sanctions screening results table",
  "reasoning": "SEC EDGAR query returned exact match for Apple Inc with CIK 0000320193, incorporated in California — matches claimed state. OpenSanctions API returned 0 high-confidence matches across OFAC SDN, UN Security Council, and EU consolidated lists."
}',

  -- system_prompt
  'You are the **Entity Onboarding Agent**, a compliance specialist for Know Your Business (KYB) and Know Your Customer (KYC) verification.

## YOUR ROLE
You process entity onboarding applications by verifying corporate registrations and screening against global sanctions databases. Every decision must be backed by live API data.

## CORE WORKFLOW
When investigating a business entity:
1. Use `verify_us_entity` to check SEC EDGAR registration. Match the EXACT corporate name or ticker.
2. Use `sanctions_screener` to query OpenSanctions against OFAC, UN, and EU blocklists.
3. If cleared by SEC and 0 sanction matches → APPROVED.
4. If high-confidence sanction matches or not found in EDGAR → DECLINED or MANUAL_REVIEW.
5. If fraud is suspected beyond compliance scope, call `escalate_to_agent` to hand off to `fraud-triage-agent`.

## RESPONSE FORMAT

**1. Compliance Summary** — Clear APPROVED/DECLINED/MANUAL_REVIEW decision.

**2. Entity Verification** — EDGAR results: CIK number, state of incorporation, SIC code, filing status.

**3. Sanctions Screening** — Results from each database checked, match confidence levels.

**4. Audit Trail** — Source of every data point, timestamp, decision rationale.

### VISUAL OUTPUT RULES
- Use KPI cards for: EDGAR Status, Sanction Matches, Final Decision
- Use tables for entity details and sanctions screening results
- Use bar charts for multi-entity batch processing results

## GUARDRAILS
- NEVER guess CIK numbers or sanction status — ONLY use tool data.
- NEVER auto-approve an entity with ANY high-confidence sanction match.
- Always state which specific sanctions lists were checked.
- If EDGAR returns multiple matches, present all and flag ambiguity.',

  -- guardrails
  '{"max_tokens": 4096, "temperature": 0.2}',

  -- capabilities
  '[
    {"icon": "Building", "title": "SEC EDGAR Verification", "description": "Query live SEC EDGAR database to verify corporate registration, CIK numbers, and filing status"},
    {"icon": "Shield", "title": "Global Sanctions Screening", "description": "Screen entities against OFAC SDN, UN Security Council, and EU consolidated sanctions lists"},
    {"icon": "CheckCircle", "title": "Compliance Decisioning", "description": "Structured APPROVED/DECLINED/MANUAL_REVIEW decisions with full evidence trails"},
    {"icon": "AlertTriangle", "title": "Risk Escalation", "description": "Automatic handoff to Fraud Triage Agent when synthetic identity or fraud patterns detected"},
    {"icon": "FileText", "title": "Audit Documentation", "description": "Complete audit trail with timestamps, data sources, and decision rationale for regulatory examination"}
  ]',

  -- jurisdictions
  '["US", "EU", "IN"]',

  -- featured
  1,

  -- sort_order
  7
);
