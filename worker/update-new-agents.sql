-- ============================================
-- Update playground_instructions for 5 new agents
-- + Fix booking-agent category
-- ============================================

-- 1. Fraud Triage Agent
UPDATE agents SET playground_instructions = 'How to use this agent:
• Click "Populate Sample" to load a pre-auth transaction with email and card BIN data
• Or describe a transaction in natural language — amount, email, card details, IP address
• You can also upload transaction logs or payment gateway exports (CSV/PDF)
• The agent checks emails against 80,000+ burner domains and queries the global Binlist BIN registry
• Decisions: APPROVE (clean), DECLINE (fraud signals), ESCALATE (needs chargeback analysis)'
WHERE slug = 'fraud-triage-agent';

-- 2. Entity Onboarding Agent (KYC/KYB)
UPDATE agents SET playground_instructions = 'How to use this agent:
• Click "Populate Sample" to load a real US company name for verification
• Or type any company name or ticker symbol — the agent queries live SEC EDGAR records
• You can also upload incorporation documents, business licenses, or KYB forms (PDF/image)
• The agent cross-references against OFAC, UN, and EU sanctions lists
• Decisions: APPROVED (cleared), DECLINED (sanctions match), MANUAL_REVIEW (ambiguous data)'
WHERE slug = 'kyc-kyb-agent';

-- 3. Regulatory Response Agent
UPDATE agents SET playground_instructions = 'How to use this agent:
• Click "Populate Sample" to load a compliance inquiry about federal regulations
• Or ask any compliance question — the agent queries the live eCFR (Electronic Code of Federal Regulations) API
• Specify a CFR Title number to narrow results (e.g., Title 12 for Banking, Title 15 for Commerce)
• The agent returns exact regulatory text with full citation hierarchy
• Great for: dispute resolution timeframes, consumer protection rules, banking compliance'
WHERE slug = 'regulatory-reporting-agent';

-- 4. Vendor Risk Agent
UPDATE agents SET playground_instructions = 'How to use this agent:
• Click "Populate Sample" to load a vendor name (e.g., CrowdStrike) for risk assessment
• Or type any third-party vendor name — the agent fetches real-time news and checks SEC registration
• You can also upload vendor questionnaires or due diligence documents (PDF/image)
• The agent monitors for: data breaches, lawsuits, outages, bankruptcy, leadership changes
• Risk levels: LOW, MEDIUM, HIGH, CRITICAL — with evidence-based scoring'
WHERE slug = 'vendor-risk-agent';

-- 5. Loan Servicing Agent
UPDATE agents SET playground_instructions = 'How to use this agent:
• Click "Populate Sample" to load a hardship/forbearance request with loan details
• Or describe a borrower situation in natural language — balance, rate, hardship reason
• The agent fetches live macroeconomic data (unemployment, GDP) from the World Bank API
• It then recalculates amortization with modified terms (rate reduction, term extension)
• Output includes: original vs modified EMI comparison, total cost impact, economic context'
WHERE slug = 'loan-servicing-agent';

-- 6. Fix booking-agent category from 'compliance' to 'accounting'
UPDATE agents SET category = 'accounting' WHERE slug = 'booking-agent';
