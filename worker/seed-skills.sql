-- Seed the central skill repository with reusable capabilities
-- extracted from existing production agents

-- 1. Entity Verification
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-entity-verification',
  'entity-verification',
  'Entity Verification',
  'Verify business entities and individuals against authoritative sources including corporate registries, sanctions lists, and digital footprint analysis.',
  'verification',
  'shield-check',
  '["verify_us_entity","sanctions_screener","burner_email_detector","rag_query"]',
  'When performing entity verification, follow this structured approach:

1. REGISTRATION CHECK
   - Use verify_us_entity for US-registered entities (SEC EDGAR, CIK resolution)
   - For non-US entities, use rag_query to check against known registry patterns
   - Validate registration number format per jurisdiction (EIN for US, CIN for India, VAT for EU)
   - Flag inconsistencies between claimed and verified registration data

2. SANCTIONS SCREENING
   - Screen entity name AND all known aliases via sanctions_screener
   - Screen key principals, directors, and UBOs if provided
   - Check against OFAC SDN, UN Security Council, EU consolidated sanctions lists
   - Apply fuzzy matching for transliterated names

3. DIGITAL FOOTPRINT VALIDATION
   - If email provided, check with burner_email_detector for disposable addresses
   - Cross-reference domain age with entity registration date
   - Flag newly created domains for established entities (mismatch indicator)

4. SCORING METHODOLOGY
   - Registration Integrity: 0-100 (weight: 0.35)
     90-100: Verified in official registry, all details match
     70-89: Partial match or minor discrepancies
     50-69: Unverifiable or significant gaps
     <50: Failed verification or fraudulent indicators
   - Sanctions Clearance: 0-100 (weight: 0.30)
     100: Clean across all sanctions lists
     50: Partial/fuzzy match requiring review
     0: Confirmed match on any sanctions list
   - Identity Confidence: 0-100 (weight: 0.20)
   - Digital Presence: 0-100 (weight: 0.15)
   - Composite = weighted sum
   - HARD OVERRIDE: If sanctions match found → composite score = 0 regardless

5. VISUAL OUTPUT
   - Emit |||KPI||| with 4 dimension scores + composite score + risk level
   - Emit |||CHART||| type:radar showing dimensional risk profile
   - Emit |||TABLE||| with detailed evidence per dimension including source citations',
  '["entity_name","registration_number","jurisdiction","email","directors"]',
  '["kpi","radar_chart","evidence_table"]'
);

-- 2. Regulatory Compliance Check
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-regulatory-compliance',
  'regulatory-compliance',
  'Regulatory Compliance Check',
  'Analyze activities against applicable regulations across jurisdictions (US, EU, India). Identify violations, gaps, and required remediation actions.',
  'compliance',
  'scale',
  '["regulatory_lookup","ecfr_lookup","rag_query","data_validation"]',
  'When performing regulatory compliance analysis:

1. JURISDICTION IDENTIFICATION
   - Determine applicable jurisdictions from entity location, transaction origins, and customer base
   - Map to specific regulatory frameworks:
     US: BSA/AML (31 CFR 1010-1022), Reg E/Z, TILA, ECOA, FCRA, CFPB rules
     EU: AMLD 4/5/6, GDPR, PSD2, MiFID II, DORA, EBA guidelines
     India: RBI Master Directions, PMLA 2002, FEMA, SEBI circulars, DPDP Act 2023

2. REGULATORY MAPPING
   - Use regulatory_lookup to identify specific applicable regulations
   - Use ecfr_lookup for US CFR text when exact regulatory language is needed
   - Cross-reference with rag_query for internal policy alignment

3. GAP ANALYSIS
   - Compare current state against regulatory requirements
   - Identify missing controls, documentation, or processes
   - Classify gaps: Critical (immediate action), Major (30-day), Minor (90-day)
   - Assess exposure: financial penalties, license risk, reputational damage

4. COMPLIANCE SCORING
   - Regulatory Coverage: 0-100 (are all applicable regs addressed?)
   - Control Effectiveness: 0-100 (are controls adequate?)
   - Documentation Quality: 0-100 (is evidence sufficient for audit?)
   - Timeliness: 0-100 (are filings and reports on schedule?)
   - Composite = weighted average with critical gap overrides

5. VISUAL OUTPUT
   - Emit |||KPI||| with compliance score, gap count by severity, exposure estimate
   - Emit |||CHART||| type:bar showing compliance by regulation/jurisdiction
   - Emit |||TABLE||| with detailed gap analysis: regulation, requirement, current state, gap, remediation',
  '["entity_name","jurisdiction","activity_type","current_controls"]',
  '["kpi","bar_chart","gap_table"]'
);

-- 3. Document Extraction & Analysis
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-document-extraction',
  'document-extraction',
  'Document Extraction & Analysis',
  'Extract structured data from uploaded documents (PDFs, images, invoices, receipts, contracts) using OCR and AI-powered analysis. Validate extracted data against business rules.',
  'processing',
  'file-search',
  '["document_analysis","data_validation","calculate"]',
  'When analyzing uploaded documents:

1. DOCUMENT CLASSIFICATION
   - Identify document type: invoice, receipt, contract, bank statement, tax form, ID document, certificate
   - Determine document quality: clear, partially readable, poor quality
   - Flag if document appears altered, expired, or potentially fraudulent

2. DATA EXTRACTION
   - Use document_analysis to extract all text and structured fields
   - For invoices: vendor, date, line items, amounts, tax, total, payment terms
   - For contracts: parties, effective date, terms, obligations, termination clauses
   - For ID documents: name, ID number, DOB, expiry, issuing authority
   - For bank statements: account holder, period, transactions, balances

3. VALIDATION & CROSS-REFERENCE
   - Use data_validation to verify extracted data formats (dates, amounts, IDs)
   - Cross-check mathematical consistency (line items sum to total, tax calculations)
   - Use calculate for financial computations (totals, tax rates, payment schedules)
   - Flag discrepancies between document fields (e.g., date inconsistencies)

4. CONFIDENCE SCORING
   - Extraction Confidence: 0-100 (OCR quality, field recognition rate)
   - Data Completeness: 0-100 (all expected fields present?)
   - Validation Pass Rate: 0-100 (how many checks passed?)

5. VISUAL OUTPUT
   - Emit |||KPI||| with extraction confidence, fields found, validation pass rate
   - Emit |||TABLE||| with all extracted fields, values, and confidence scores
   - Flag any fields that need human review',
  '["document_file","document_type","validation_rules"]',
  '["kpi","extraction_table","validation_summary"]'
);

-- 4. Risk Scoring & Assessment
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-risk-scoring',
  'risk-scoring',
  'Risk Scoring & Assessment',
  'Multi-dimensional risk assessment with weighted composite scoring. Supports configurable risk dimensions, thresholds, and automated risk categorization.',
  'analysis',
  'bar-chart-3',
  '["calculate","data_validation","rag_query"]',
  'When performing risk assessment:

1. DIMENSION IDENTIFICATION
   - Identify 4-6 risk dimensions relevant to the analysis context
   - Each dimension should be independently measurable and evidence-based
   - Common dimension patterns:
     Financial Risk: transaction patterns, amounts, velocity
     Behavioral Risk: account age, activity patterns, anomalies
     Geographic Risk: high-risk jurisdictions, cross-border flows
     Identity Risk: verification status, document quality, consistency
     Regulatory Risk: compliance status, reporting obligations
     Operational Risk: process maturity, control effectiveness

2. EVIDENCE GATHERING
   - Use rag_query to pull relevant benchmarks and historical patterns
   - Use data_validation to verify input data quality and completeness
   - Score each dimension 0-100 based on available evidence
   - Document specific evidence supporting each score

3. COMPOSITE SCORING
   - Use calculate for weighted scoring:
     Composite = sum(dimension_score * weight) for all dimensions
     Weights must sum to 1.0
   - Apply hard override rules (any dimension <20 → flag for review)
   - Calculate confidence based on data completeness

4. RISK CATEGORIZATION
   - 80-100: Low Risk (auto-approve eligible)
   - 60-79: Medium Risk (standard review)
   - 40-59: Elevated Risk (enhanced review required)
   - 20-39: High Risk (senior review + additional documentation)
   - 0-19: Critical Risk (auto-reject or immediate escalation)

5. VISUAL OUTPUT
   - Emit |||KPI||| with composite score, risk category, confidence level, key risk driver
   - Emit |||CHART||| type:radar showing dimensional risk profile
   - Emit |||CHART||| type:bar showing score breakdown by dimension
   - Emit |||TABLE||| with dimension details: score, weight, evidence, flags',
  '["entity_data","transaction_data","risk_dimensions"]',
  '["kpi","radar_chart","bar_chart","risk_table"]'
);

-- 5. Credit Evaluation
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-credit-evaluation',
  'credit-evaluation',
  'Credit Evaluation',
  'Comprehensive credit assessment including DTI calculation, affordability analysis, LTV ratios, and EMI computation. Supports consumer and commercial lending decisions.',
  'analysis',
  'credit-card',
  '["credit_assessment","calculate","macroeconomic_indicator","amortization_restructurer"]',
  'When evaluating credit applications:

1. FINANCIAL METRICS
   - Use credit_assessment for core calculations:
     DTI (Debt-to-Income): total monthly debt / gross monthly income
     LTV (Loan-to-Value): loan amount / collateral value
     Affordability: net disposable income after proposed EMI
   - Use calculate for additional financial ratios
   - Use macroeconomic_indicator for current benchmark rates

2. CREDITWORTHINESS DIMENSIONS
   - Repayment Capacity: DTI, disposable income, employment stability (weight: 0.30)
   - Collateral Quality: LTV, asset type, valuation method (weight: 0.25)
   - Credit History: score, delinquencies, utilization, age of accounts (weight: 0.25)
   - Stability Factors: employment tenure, residential stability, banking relationship (weight: 0.20)

3. LOAN STRUCTURING
   - Use amortization_restructurer to generate payment schedules
   - Model different scenarios: standard, extended term, step-up EMI
   - Calculate total interest cost and breakeven points
   - Stress test against rate increases (+1%, +2%, +3%)

4. DECISION FRAMEWORK
   - Approve: DTI <36%, LTV <80%, credit score >720, all dimensions >70
   - Conditional: DTI 36-43% OR LTV 80-90% → require additional documentation
   - Decline: DTI >43% OR LTV >90% OR credit score <620 OR any dimension <40
   - Always explain the decision rationale with specific data points

5. VISUAL OUTPUT
   - Emit |||KPI||| with DTI, LTV, EMI, affordability surplus, decision
   - Emit |||CHART||| type:bar showing dimensional creditworthiness profile
   - Emit |||TABLE||| with amortization schedule (first 12 months + summary)
   - Emit |||TABLE||| with stress test scenarios',
  '["applicant_income","existing_debts","loan_amount","loan_term","collateral_value","credit_score"]',
  '["kpi","bar_chart","amortization_table","stress_test_table"]'
);

-- 6. Adverse Media Screening
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-adverse-media',
  'adverse-media',
  'Adverse Media Screening',
  'Screen entities and individuals against news sources for adverse media mentions including fraud allegations, regulatory actions, litigation, and reputational risks.',
  'intelligence',
  'newspaper',
  '["rss_news_parser","rag_query","sanctions_screener"]',
  'When screening for adverse media:

1. SOURCE SCANNING
   - Use rss_news_parser to search major financial news feeds
   - Use rag_query for historical adverse media records in knowledge base
   - Cross-reference with sanctions_screener for regulatory enforcement actions
   - Search categories: fraud, money laundering, corruption, sanctions violations, regulatory fines, litigation, bankruptcy, environmental violations

2. RELEVANCE ASSESSMENT
   - Confirm entity name match (avoid false positives from common names)
   - Verify temporal relevance (recent vs. historical)
   - Assess severity: criminal charges > regulatory fines > civil litigation > allegations
   - Determine materiality: direct involvement vs. association vs. industry-wide

3. RISK CATEGORIZATION
   - Critical: Active criminal investigation, sanctions designation, fraud conviction
   - High: Regulatory enforcement action, significant litigation, recent allegations
   - Medium: Historical issues (>3 years), resolved litigation, industry warnings
   - Low: Minor regulatory comments, dismissed cases, tangential mentions
   - Clear: No adverse media found across all sources

4. VISUAL OUTPUT
   - Emit |||KPI||| with total mentions, severity breakdown, risk category, most recent finding
   - Emit |||TABLE||| with each finding: source, date, category, severity, summary, URL
   - Emit |||CHART||| type:pie showing distribution by category',
  '["entity_name","aliases","jurisdiction","time_period"]',
  '["kpi","findings_table","category_chart"]'
);

-- 7. Transaction Monitoring
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-transaction-monitoring',
  'transaction-monitoring',
  'Transaction Monitoring',
  'Analyze transactions for suspicious patterns including velocity anomalies, structuring, geographic risks, and behavioral deviations from established baselines.',
  'compliance',
  'activity',
  '["calculate","data_validation","rag_query"]',
  'When monitoring transactions:

1. PATTERN ANALYSIS
   - Use calculate for velocity metrics: daily/weekly/monthly volume and value
   - Detect structuring: multiple transactions just below reporting thresholds
   - Identify round-amount patterns (potential layering indicator)
   - Analyze time-of-day patterns and unusual timing
   - Compare against peer group baselines using rag_query

2. GEOGRAPHIC RISK
   - Map transaction origins and destinations to risk classifications
   - Flag high-risk jurisdictions (FATF grey/black list)
   - Detect unusual geographic patterns (sudden new corridors)
   - Cross-border flow analysis

3. BEHAVIORAL ANALYSIS
   - Compare against account holder baseline (historical activity)
   - Detect sudden changes in transaction patterns
   - Identify dormant account reactivation
   - Flag mismatches between declared activity and actual behavior

4. ALERT SCORING
   - Transaction Risk: amount, frequency, counterparty risk (weight: 0.30)
   - Pattern Risk: structuring indicators, velocity anomalies (weight: 0.25)
   - Geographic Risk: jurisdiction risk, corridor risk (weight: 0.25)
   - Behavioral Risk: deviation from baseline, account age factors (weight: 0.20)
   - SAR recommendation threshold: composite <50

5. VISUAL OUTPUT
   - Emit |||KPI||| with risk score, alert level, key risk indicator, transaction count
   - Emit |||CHART||| type:line showing transaction velocity over time
   - Emit |||TABLE||| with flagged transactions: ID, amount, counterparty, risk factors',
  '["transactions","account_id","account_age_days","declared_activity"]',
  '["kpi","velocity_chart","flagged_transactions_table"]'
);

-- 8. Collections Strategy
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-collections-strategy',
  'collections-strategy',
  'Collections & Recovery Strategy',
  'Assess debtor risk profiles and recommend optimal collection strategies with recovery probability estimates and prioritized action plans.',
  'analysis',
  'wallet',
  '["collections_scoring","calculate","rag_query"]',
  'When developing collection strategies:

1. DEBTOR ASSESSMENT
   - Use collections_scoring for debtor risk profile and recovery probability
   - Analyze: days past due, outstanding balance, payment history, contact success rate
   - Use calculate for aging analysis and recovery projections

2. SEGMENTATION
   - Early Stage (1-30 DPD): Soft reminders, payment plan offers
   - Mid Stage (31-90 DPD): Escalated contact, restructuring proposals
   - Late Stage (91-180 DPD): Formal demand, settlement offers
   - Write-off Zone (>180 DPD): Legal assessment, agency referral, charge-off analysis

3. STRATEGY RECOMMENDATION
   - Based on debtor profile, recommend optimal approach
   - Consider: willingness to pay vs. ability to pay
   - Factor in cost of collection vs. expected recovery
   - Regulatory constraints per jurisdiction (FDCPA for US, RBI guidelines for India)

4. RECOVERY OPTIMIZATION
   - Use calculate for NPV of different recovery scenarios
   - Compare: full payment plan, lump-sum settlement, legal action, write-off
   - Factor in time value of money and collection costs
   - Use rag_query for historical recovery rates by segment

5. VISUAL OUTPUT
   - Emit |||KPI||| with recovery probability, recommended strategy, expected recovery amount, priority score
   - Emit |||CHART||| type:bar showing recovery scenarios comparison
   - Emit |||TABLE||| with action plan: timeline, action, expected outcome, escalation trigger',
  '["debtor_name","outstanding_balance","days_past_due","payment_history","contact_attempts"]',
  '["kpi","scenario_chart","action_plan_table"]'
);

-- 9. Financial Reconciliation
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-financial-reconciliation',
  'financial-reconciliation',
  'Financial Reconciliation',
  'Match and reconcile financial records across sources including invoices, payments, bank statements, and ledger entries. Identify discrepancies and propose resolutions.',
  'processing',
  'git-compare',
  '["calculate","data_validation","document_analysis"]',
  'When performing financial reconciliation:

1. DATA INGESTION
   - Use document_analysis if documents are uploaded (invoices, statements)
   - Use data_validation to verify data formats and completeness
   - Normalize data: currency conversion, date standardization, entity name matching

2. MATCHING LOGIC
   - Primary match: exact amount + date + reference number
   - Secondary match: amount + approximate date (±3 days) + partial reference
   - Fuzzy match: similar amounts (±1%) + entity name similarity
   - Use calculate for amount tolerance checks and currency conversions

3. DISCREPANCY ANALYSIS
   - Classify discrepancies: timing (matched but different dates), amount (partial matches), unmatched (no counterpart found)
   - Calculate materiality: discrepancy amount as % of total
   - Identify patterns: systematic errors, recurring mismatches, one-off issues
   - Propose resolutions: timing adjustment, partial payment allocation, investigation needed

4. RECONCILIATION SCORING
   - Match Rate: % of items successfully reconciled
   - Accuracy: % of matches confirmed correct
   - Discrepancy Value: total unresolved amount
   - Completion: all items addressed (matched or flagged)

5. VISUAL OUTPUT
   - Emit |||KPI||| with match rate, total reconciled, discrepancy count, unresolved amount
   - Emit |||CHART||| type:pie showing matched vs unmatched vs partial
   - Emit |||TABLE||| with discrepancies: item, expected, actual, difference, proposed resolution',
  '["source_records","target_records","tolerance_percent","date_range"]',
  '["kpi","match_chart","discrepancy_table"]'
);

-- 10. Report Generation
INSERT OR IGNORE INTO skills (id, slug, name, description, category, icon, required_tools, prompt_template, input_hints, visual_outputs) VALUES (
  'skill-report-generation',
  'report-generation',
  'Report Generation',
  'Generate structured, auditable reports with executive summaries, detailed findings, evidence citations, and actionable recommendations. Supports compliance and management reporting.',
  'communication',
  'file-text',
  '["rag_query","calculate"]',
  'When generating reports:

1. REPORT STRUCTURE
   - Executive Summary: 3-5 bullet points, key findings, overall assessment
   - Methodology: what was analyzed, data sources, time period, tools used
   - Detailed Findings: organized by dimension/category with evidence
   - Risk Assessment: if applicable, scored dimensions with supporting data
   - Recommendations: prioritized actions with timeline and responsibility
   - Appendix: raw data references, calculation details, disclaimer

2. EVIDENCE STANDARDS
   - Every claim must cite its source (tool result, document, knowledge base)
   - Use rag_query to reference internal policies and benchmarks
   - Use calculate for any derived metrics, showing the formula
   - Distinguish between facts (verified), assessments (analyzed), and opinions (recommended)

3. FORMATTING GUIDELINES
   - Use clear section headers and numbered findings
   - Bold key metrics and risk levels
   - Include confidence levels for assessments
   - Add timestamps for all data points
   - Include regulatory references where applicable

4. AUDIT TRAIL
   - Document every tool call and its result
   - Record data sources and retrieval timestamps
   - Note any data gaps or limitations
   - Include system prompt hash for reproducibility

5. VISUAL OUTPUT
   - Emit |||KPI||| with overall assessment, key metrics, report date, confidence
   - Emit |||TABLE||| with findings summary: #, finding, severity, evidence, recommendation
   - Include all relevant charts from analysis skills used',
  '["analysis_subject","report_type","time_period","audience"]',
  '["kpi","findings_table","charts"]'
);
