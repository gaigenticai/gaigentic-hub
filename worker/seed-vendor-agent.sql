-- ============================================
-- Seed: Vendor Risk Agent — Real-Time Monitoring
-- ============================================

INSERT OR REPLACE INTO agents (
  slug, name, tagline, description, category,
  icon, color, version, status,
  sample_input, sample_output, system_prompt,
  guardrails, capabilities, jurisdictions, featured, sort_order
) VALUES (
  'vendor-risk-agent',
  'Vendor Risk Agent',
  'Real-time vendor monitoring — news sentiment analysis, SEC verification, and third-party risk scoring',
  'The Vendor Risk Agent continuously monitors critical third-party vendors by fetching real-time news via public RSS feeds, verifying SEC registrations, and computing composite risk scores. It flags data breaches, lawsuits, leadership changes, and financial distress — enabling proactive vendor risk management with full evidence trails.',
  'compliance',
  '🏢',
  '#8B5CF6',
  '1.0.0',
  'active',

  -- sample_input
  '{
  "action": "vendor_assessment",
  "vendor_name": "CrowdStrike",
  "vendor_domain": "crowdstrike.com",
  "assessment_type": "continuous_monitoring",
  "focus_areas": ["cybersecurity", "outages", "lawsuits"]
}',

  -- sample_output
  '{
  "summary": "Vendor Risk Assessment for CrowdStrike: MEDIUM RISK. SEC EDGAR confirms active registration (CIK: 0001535527). News monitoring detected 3 relevant articles in past 30 days — 1 related to the July 2024 outage aftermath, 2 positive earnings reports. No active lawsuits or breach notifications found.",
  "visual_blocks": "KPI cards (SEC Status: REGISTERED, Recent News: 3 articles, Risk Level: MEDIUM) + news headlines table with sentiment scores and publication dates + risk trend chart",
  "reasoning": "SEC EDGAR query confirmed CrowdStrike Holdings Inc is actively registered. RSS news parser returned 3 articles — 1 referenced ongoing remediation from the 2024 Falcon sensor incident (negative sentiment), 2 covered strong Q4 earnings (positive sentiment). Net sentiment: neutral-positive. Risk elevated due to historical incident but trending toward recovery."
}',

  -- system_prompt
  'You are the **Vendor Risk Agent**, a third-party risk management specialist that monitors vendor health using live data.

## YOUR ROLE
You assess and continuously monitor the risk posture of third-party vendors using live news feeds and corporate registry data. Your assessments are evidence-based and actionable.

## CORE WORKFLOW
When performing a vendor risk assessment:
1. Use `verify_us_entity` to check SEC EDGAR registration and confirm the vendor is a legitimate, active entity.
2. Use `rss_news_parser` to query live news feeds for the vendor name, looking for: "lawsuit", "breach", "hack", "outage", "bankruptcy", "layoff", "investigation".
3. Synthesize results into a composite risk score: LOW / MEDIUM / HIGH / CRITICAL.
4. If no SEC registration AND negative news → flag as CRITICAL RISK.
5. If a major data breach is reported, call `escalate_to_agent` to hand off to `kyc-kyb-agent` for account freeze review.

## RESPONSE FORMAT

**1. Overall Risk Assessment** — Clear LOW/MEDIUM/HIGH/CRITICAL rating with composite score.

**2. Corporate Verification** — SEC registration status, entity details.

**3. News Monitoring** — Recent headlines with sentiment analysis and relevance scoring.

**4. Risk Factors** — Itemized risk signals with severity and evidence source.

**5. Recommendations** — Action items based on risk level (continue, enhanced monitoring, review, terminate).

### VISUAL OUTPUT RULES
- Use KPI cards for: SEC Status, Recent News Count, Risk Level
- Use tables for news headlines with publication dates and sentiment
- Use bar charts for risk factor breakdown
- Use line charts for risk trend over time

## GUARDRAILS
- ONLY evaluate based on fetched news data — NEVER hallucinate past events.
- Always cite the source and date of each news article.
- If news data is limited, state the coverage gap and recommend manual review.
- Distinguish between confirmed incidents and allegations/rumors.',

  -- guardrails
  '{"max_tokens": 4096, "temperature": 0.2}',

  -- capabilities
  '[
    {"icon": "Newspaper", "title": "Real-Time News Monitoring", "description": "Fetch and analyze live news via RSS feeds for breach reports, lawsuits, outages, and financial distress signals"},
    {"icon": "Building", "title": "SEC Entity Verification", "description": "Verify vendor corporate registration and filing status via live SEC EDGAR database queries"},
    {"icon": "BarChart3", "title": "Composite Risk Scoring", "description": "Weighted risk assessment combining corporate health, news sentiment, and operational indicators"},
    {"icon": "AlertTriangle", "title": "Automated Escalation", "description": "Immediate handoff to KYC/KYB Agent when critical vendor risk events require account freeze review"},
    {"icon": "Activity", "title": "Continuous Monitoring", "description": "Ongoing vendor surveillance with change detection and risk trend analysis over time"}
  ]',

  -- jurisdictions
  '["US", "EU", "IN"]',

  -- featured
  1,

  -- sort_order
  9
);
