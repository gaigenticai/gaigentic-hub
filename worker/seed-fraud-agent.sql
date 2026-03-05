-- ============================================
-- Seed: Fraud Triage Agent — Pre-Auth Security
-- ============================================

INSERT OR REPLACE INTO agents (
  slug, name, tagline, description, category,
  icon, color, version, status,
  sample_input, sample_output, system_prompt,
  guardrails, capabilities, jurisdictions, featured, sort_order
) VALUES (
  'fraud-triage-agent',
  'Fraud Triage Agent',
  'Pre-authorization security — BIN scanning, burner email detection, and real-time fraud decisioning',
  'The Fraud Triage Agent intercepts transactions BEFORE authorization. It queries real burner email databases (80,000+ disposable domains) and the global Binlist BIN registry to detect synthetic identities, prepaid card fraud, and geographic mismatches. Every decision is evidence-based with a full forensic breakdown.',
  'compliance',
  '🛡',
  '#EF4444',
  '1.0.0',
  'active',

  -- sample_input
  '{
  "action": "pre_auth_check",
  "transaction_id": "TXN-88192-X",
  "amount_usd": 1499.00,
  "customer": {
    "email": "fraudster99@10minutemail.com",
    "ip_address": "89.187.160.0",
    "billing_country": "US"
  },
  "payment": {
    "card_bin": "511111",
    "last4": "2024"
  }
}',

  -- sample_output
  '{
  "summary": "Pre-Auth Fraud Decision for TXN-88192-X: DECLINE. Burner email detected (10minutemail.com is in disposable domain list). BIN 511111 maps to Mastercard Credit issued by ICICI Bank, India — geographic mismatch with US billing address. Combined risk score: 92/100 (Critical).",
  "visual_blocks": "KPI cards (Burner Status: DETECTED, Card Type: Credit, Issuer Country: IN, Decision: DECLINE) + forensic breakdown table with email domain analysis and BIN metadata",
  "reasoning": "Email domain 10minutemail.com matched against burner database. BIN 511111 resolved via Binlist API to ICICI Bank India — does not match claimed US billing. Two independent fraud signals confirm DECLINE."
}',

  -- system_prompt
  'You are the **Fraud Triage Agent**, a pre-authorization security specialist that intercepts transactions before settlement.

## YOUR ROLE
You analyze transactions in real-time BEFORE they are authorized. You use verified tool data — never guesses — to make APPROVE/DECLINE/ESCALATE decisions.

## CORE WORKFLOW
When investigating a transaction:
1. Extract the user email and run `burner_email_detector` to check against 80,000+ known disposable domains.
2. Extract the card BIN/IIN (first 6 digits) and run `bin_iin_lookup` to check the issuing bank, country, and card type.
3. If the card country does not match the billing/IP address geography, flag geographic mismatch.
4. If the card is Prepaid or the email is a burner, heavily penalize the trust score and DECLINE.
5. If the transaction needs deep dispute analysis, call `escalate_to_agent` to hand off to `chargeback-validity`.

## RESPONSE FORMAT

**1. Pre-Auth Decision** — Clear APPROVE/DECLINE/ESCALATE with risk score (0-100).

**2. Forensic Breakdown** — Evidence table showing:
  - Email domain analysis (burner status, domain age, pattern match)
  - BIN metadata (issuer, country, card type, brand)
  - Geographic correlation (IP vs billing vs card issuer)

**3. Audit Trail** — For every signal, cite the exact tool data source.

### VISUAL OUTPUT RULES
- Use KPI cards for: Burner Status, Card Type, Issuer Country, Final Decision
- Use tables for forensic breakdown of email and BIN data
- Use bar charts for risk score composition

## GUARDRAILS
- NEVER guess burner status or BIN data — ONLY use tool results.
- NEVER approve a transaction with 2+ independent fraud signals.
- Always state confidence level for each signal.
- Flag any data gaps that prevented full analysis.',

  -- guardrails
  '{"max_tokens": 4096, "temperature": 0.2}',

  -- capabilities
  '[
    {"icon": "Shield", "title": "Burner Email Detection", "description": "Check emails against 80,000+ known disposable domains with real-time database queries"},
    {"icon": "CreditCard", "title": "BIN/IIN Lookup", "description": "Query global Binlist registry for card issuer, country, type (credit/debit/prepaid), and brand"},
    {"icon": "Globe", "title": "Geographic Risk Correlation", "description": "Cross-reference IP geolocation, billing address, and card issuer country for mismatch detection"},
    {"icon": "AlertTriangle", "title": "Real-Time Decisioning", "description": "APPROVE/DECLINE/ESCALATE decisions with weighted risk scoring and full forensic evidence"},
    {"icon": "ArrowRight", "title": "Agent Escalation", "description": "Seamless handoff to Chargeback Agent for post-authorization dispute cases"}
  ]',

  -- jurisdictions
  '["US", "EU", "IN"]',

  -- featured
  1,

  -- sort_order
  6
);
