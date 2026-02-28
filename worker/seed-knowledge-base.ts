/**
 * Knowledge Base Seed Script
 *
 * Seeds Vectorize with regulatory/compliance knowledge for all agents.
 * Run via: npx tsx worker/seed-knowledge-base.ts
 *
 * Requires: API_BASE and ADMIN_TOKEN environment variables
 * Or edit the constants below.
 */

const API_BASE = process.env.API_BASE || "https://gaigentic-hub-api.krishnagaigenticai.workers.dev";

// Get admin token by logging in first
async function getAdminToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "krishna@gaigentic.ai" }),
  });
  const data = await res.json() as { token?: string };
  if (!data.token) throw new Error("Failed to get admin token");
  return data.token;
}

async function ingest(token: string, doc: { agent_id?: string; source_type: string; source_name: string; content: string }) {
  const res = await fetch(`${API_BASE}/rag/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(doc),
  });
  const data = await res.json() as { success?: boolean; chunks_inserted?: number; error?: string };
  if (!data.success) {
    console.error(`  FAILED: ${doc.source_name} — ${data.error}`);
    return 0;
  }
  console.log(`  ✓ ${doc.source_name}: ${data.chunks_inserted} chunks`);
  return data.chunks_inserted || 0;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KNOWLEDGE BASE DOCUMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SHARED_KNOWLEDGE = [
  {
    source_type: "regulation",
    source_name: "US BSA/AML Framework",
    content: `Bank Secrecy Act (BSA) — Anti-Money Laundering Framework

The Bank Secrecy Act (BSA), enacted in 1970 and amended by the USA PATRIOT Act (2001), is the primary US anti-money laundering law. It requires financial institutions to assist government agencies in detecting and preventing money laundering.

CURRENCY TRANSACTION REPORTS (CTR)
- Filing threshold: $10,000 in cash transactions per business day
- Applies to: deposits, withdrawals, exchanges of currency, other payments/transfers by cash
- Aggregation rule: Multiple cash transactions by or on behalf of the same person totaling more than $10,000 in one business day must be treated as a single transaction
- Filing deadline: 15 calendar days after the date of the transaction
- Form: FinCEN Form 112 (CTR)
- Exemptions: Banks, government agencies, NYSE/AMEX listed companies may be exempt via FinCEN Form 110
- Penalties for failure to file: Civil penalty up to $25,000 per violation; criminal penalty up to $250,000 and/or 5 years imprisonment

SUSPICIOUS ACTIVITY REPORTS (SAR)
- Filing threshold: $5,000 for banks and bank holding companies; $2,000 for money services businesses (MSBs)
- No threshold if transaction involves potential terrorism financing
- Must file if transaction appears to involve funds from illegal activity, designed to evade BSA requirements, lacks lawful purpose, or involves use of financial institution to facilitate criminal activity
- Filing deadline: 30 days after initial detection of suspicious activity; 60 days if no suspect identified
- Form: FinCEN Form 111 (SAR)
- Confidentiality: It is a federal crime (31 USC §5318(g)(2)) to disclose that a SAR has been filed
- Continuing activity: If suspicious activity is ongoing, file a continuing SAR every 90 days
- SAR supporting documentation must be retained for 5 years

STRUCTURING (31 USC §5324)
Definition: Breaking up transactions into smaller amounts to avoid CTR filing thresholds. Also known as "smurfing."
- It is a federal crime to structure or assist in structuring transactions to evade reporting requirements
- Applies regardless of whether the underlying funds are legally obtained
- Penalties: Up to $250,000 fine and/or 5 years imprisonment per offense
- Key indicators:
  * Multiple cash deposits just below $10,000 on same day or consecutive days
  * Multiple transactions at different branches
  * Customer shows awareness of CTR requirements
  * Customer requests not to file CTR
  * Transactions inconsistent with customer's normal activity
  * Use of multiple accounts to keep individual deposits below $10,000
- Case law: United States v. Rybicki (2002) established that structuring is illegal regardless of the source of funds

314(b) INFORMATION SHARING
- Voluntary program allowing financial institutions to share information with each other to identify and report potential money laundering or terrorist activity
- Protected from liability for sharing information under Safe Harbor provisions
- Must register with FinCEN to participate

CUSTOMER DUE DILIGENCE (CDD) RULE
- Effective May 2018 (31 CFR 1010.230)
- Requires identification and verification of beneficial owners (25%+ ownership) for legal entity customers
- Risk-based ongoing monitoring of customer relationships
- Four pillars: identify customer, verify identity, understand nature of relationship, conduct ongoing monitoring`,
  },
  {
    source_type: "regulation",
    source_name: "US Consumer Protection — Reg E and Reg Z",
    content: `US Consumer Protection for Electronic Payments and Credit Cards

REGULATION E — ELECTRONIC FUND TRANSFER ACT (EFTA)
12 CFR Part 1005 — Governs electronic fund transfers (debit cards, ATM, ACH, P2P)

Consumer Liability for Unauthorized Transfers:
- Reported within 2 business days: Maximum $50 liability
- Reported after 2 but within 60 days of statement: Maximum $500 liability
- Reported after 60 days from statement: Consumer bears full loss for transfers occurring after the 60-day period
- Important: The consumer is NOT liable for unauthorized transfers that occur after notification to the bank

Bank Investigation Timeline:
- 10 business days to investigate (20 business days for new accounts opened <30 days)
- If investigation exceeds 10 business days: Must provide provisional credit for the disputed amount
- 45 days to complete investigation (90 days for new accounts, international transactions, or POS debit card transactions)
- Must provide written determination within 3 business days of completing investigation
- If error is confirmed: Correct the error within 1 business day

Error Resolution Rights:
- Consumer must notify institution within 60 days of statement showing error
- Oral notice is sufficient to trigger investigation
- Institution may require written confirmation within 10 business days of oral notice

REGULATION Z — TRUTH IN LENDING ACT (TILA)
12 CFR Part 1026 — Governs credit card transactions

Consumer Liability:
- Maximum $50 for unauthorized credit card charges
- Most card networks offer zero liability policies beyond Reg Z
- Billing error claims must be submitted within 60 days of statement date

Issuer Obligations:
- Must acknowledge billing error notice within 30 days
- Must resolve within 2 complete billing cycles (maximum 90 days)
- Must provide provisional credit during investigation
- Cannot report amount as delinquent during dispute
- Must provide written explanation of investigation results

Billing Error Categories:
- Unauthorized charges
- Charges for goods/services not received
- Incorrect amount charged
- Mathematical or computational errors
- Charges for which consumer requests clarification

CFPB GUIDANCE
- Consumer Financial Protection Bureau oversees Reg E and Reg Z enforcement
- Complaint submission at consumerfinance.gov
- Supervisory examination manual provides detailed examination procedures
- Error resolution is separate from fraud investigation — both must be conducted`,
  },
  {
    source_type: "regulation",
    source_name: "EU AML Directives and PSD2",
    content: `European Union Anti-Money Laundering and Payment Services Framework

4th/5th/6th ANTI-MONEY LAUNDERING DIRECTIVES (AMLD)

4th AMLD (2015/849/EU) — Effective June 2017:
- Customer Due Diligence (CDD) threshold: €15,000 for occasional transactions
- Beneficial ownership registers mandatory for all EU member states
- Risk-based approach to customer due diligence
- Suspicious Transaction Reports (STRs) to national Financial Intelligence Units (FIUs)
- Politically Exposed Persons (PEPs): Enhanced due diligence required, including domestic PEPs

5th AMLD (2018/843/EU) — Effective January 2020:
- Extends AML requirements to cryptocurrency exchanges and wallet providers
- Public access to beneficial ownership registers
- Enhanced due diligence for high-risk third countries
- Lowered threshold for prepaid cards to €150 (from €250)
- Central registers of bank accounts in each member state

6th AMLD (2019/1153/EU) — Effective December 2020:
- Harmonized list of 22 predicate offenses (including tax crimes, cybercrime, environmental crime)
- Criminal liability extended to legal persons (companies)
- Minimum 4 years imprisonment for money laundering offenses
- Aiding, abetting, and attempted money laundering all criminalized
- Enhanced cooperation between FIUs across member states

PAYMENT SERVICES DIRECTIVE 2 (PSD2) — STRONG CUSTOMER AUTHENTICATION

Requirements:
- Strong Customer Authentication (SCA) mandatory for electronic payments
- Two of three authentication factors required:
  * Knowledge (something the customer knows): password, PIN, security question
  * Possession (something the customer has): phone, hardware token, smart card
  * Inherence (something the customer is): fingerprint, face recognition, voice

SCA Exemptions:
- Low value: Transactions under €30 (cumulative limit: €100 or 5 consecutive transactions without SCA)
- Low risk: Transaction Risk Analysis (TRA) exemption based on acquirer/issuer fraud rates
  * Up to €500 if fraud rate < 0.01%
  * Up to €250 if fraud rate < 0.06%
  * Up to €100 if fraud rate < 0.13%
- Recurring: Fixed-amount recurring payments to same payee (after first SCA)
- Trusted beneficiaries: Customer-maintained whitelist
- Corporate: Secure corporate payment processes and protocols
- Contactless: Up to €50 (cumulative €150 or 5 transactions)

Liability Shift:
- If merchant performed SCA: Liability shifts to issuer for disputed transaction
- If merchant did NOT perform SCA: Merchant bears liability for fraudulent transactions
- This is the single most important defense/attack point in EU chargeback disputes

GDPR Implications for AML:
- AML data processing lawful under Article 6(1)(c) — legal obligation
- Retention: 5 years after business relationship ends (AMLD requirement overrides GDPR minimization)
- Data minimization still applies — collect only what is necessary for AML compliance
- Cross-border transfers: Standard Contractual Clauses required outside EU/EEA
- Right to erasure does not apply to AML-required records during retention period`,
  },
  {
    source_type: "regulation",
    source_name: "India AML/CFT — PMLA and RBI Directions",
    content: `India Anti-Money Laundering and Counter-Terrorism Financing Framework

PREVENTION OF MONEY LAUNDERING ACT, 2002 (PMLA)
India's primary anti-money laundering legislation, administered by the Enforcement Directorate (ED).

Reporting Requirements:
- Cash Transaction Reports (CTR): Mandatory for cash transactions exceeding ₹10,00,000 (₹10 lakh / approx. $12,000)
- Suspicious Transaction Reports (STR): No monetary threshold — ANY transaction that appears suspicious must be reported
- Cross-border wire transfers: All transfers of ₹5,00,000 or more must be reported
- Filing body: Financial Intelligence Unit — India (FIU-IND)
- CTR filing: Monthly (by 15th of following month)
- STR filing: Within 7 days of detection (principal officer must report to FIU-IND within 15 days)

Record Keeping:
- All transaction records must be maintained for 10 years from the date of transaction
- Records of identification obtained through CDD must be maintained for 10 years after business relationship ends
- Records must be sufficient to permit reconstruction of individual transactions

Penalties:
- Money laundering offense: Rigorous imprisonment of 3-7 years
- If involving scheduled offense under NDPS Act: Up to 10 years
- Attachment and confiscation of property involved in money laundering
- Fine up to ₹5,00,000 for non-compliance with reporting obligations

RBI MASTER DIRECTION ON KYC (2016, updated 2023)
Reserve Bank of India's Know Your Customer framework.

Customer Due Diligence:
- Aadhaar-based e-KYC for individual accounts
- PAN verification mandatory for transactions above ₹50,000
- Risk categorization: Low, Medium, High
- Video-based Customer Identification Process (V-CIP) permitted since January 2020

Enhanced Due Diligence Triggers:
- Politically Exposed Persons (PEPs)
- Customers from high-risk countries/territories
- Non-face-to-face accounts
- Transactions that are unusual or complex with no apparent economic rationale
- Correspondent banking relationships

Periodic Review:
- Low risk: Every 10 years
- Medium risk: Every 8 years
- High risk: Every 2 years

RBI CIRCULAR ON LIMITING LIABILITY (2017/2019)
Consumer protection for unauthorized electronic transactions.

Zero Liability:
- Customer has zero liability if unauthorized transaction is reported within 3 working days of receiving notification from the bank
- Applies to: debit cards, credit cards, net banking, UPI, mobile banking, prepaid instruments

Limited Liability:
- 4-7 working days: Customer liability capped at ₹5,000 to ₹25,000 depending on account type
  * BSBD accounts: ₹5,000
  * Regular savings/current accounts: ₹10,000
  * Credit cards (limit up to ₹5 lakh): ₹10,000
  * Credit cards (limit above ₹5 lakh): ₹25,000

Full Liability:
- Beyond 7 working days: Customer bears full liability
- Exception: If bank took more than 3 working days to notify customer of the transaction

Bank Obligations:
- Must resolve dispute within 90 days
- Must provide shadow/provisional credit within 10 working days (T+10) if customer not at fault
- Must send real-time transaction alerts via SMS/email

FOREIGN EXCHANGE MANAGEMENT ACT (FEMA) 1999:
- Liberalised Remittance Scheme (LRS): $250,000 per financial year per resident individual
- All cross-border transactions must be reported to RBI via Authorized Dealer banks
- Purpose codes required for all outward remittances`,
  },
  {
    source_type: "regulation",
    source_name: "FATF Standards and Country Risk",
    content: `Financial Action Task Force (FATF) — International AML/CFT Standards

ABOUT FATF:
- Intergovernmental body established in 1989 by the G7
- Sets international standards for combating money laundering, terrorist financing, and proliferation financing
- 40 Recommendations form the global AML/CFT framework
- Mutual evaluations assess country compliance

FATF GREY LIST (Jurisdictions under Increased Monitoring — February 2024):
Countries with strategic deficiencies in AML/CFT but committed to action plans:
Bulgaria, Burkina Faso, Cameroon, Croatia, Democratic Republic of Congo, Haiti, Kenya, Mali, Monaco, Mozambique, Namibia, Nigeria, South Africa, South Sudan, Syria, Tanzania, Venezuela, Vietnam, Yemen

Implications for Grey List:
- Enhanced Due Diligence (EDD) required for business relationships and transactions
- Additional scrutiny for correspondent banking
- Must demonstrate awareness of risks in compliance programs
- Not automatic blocking, but risk-based approach mandated

FATF BLACK LIST (High-Risk Jurisdictions subject to Call for Action):
Countries with significant strategic deficiencies:
Iran, Myanmar (Burma), North Korea (DPRK)

Implications for Black List:
- Counter-measures required by all FATF member countries
- May include: enhanced due diligence, limiting business relationships, prohibiting correspondent accounts
- Transactions involving these countries should trigger automatic escalation
- Financial institutions should consider whether to maintain any business relationships

FATF 40 RECOMMENDATIONS — Key Requirements:
1. Risk assessment and risk-based approach (Rec 1)
2. National cooperation and coordination (Rec 2)
3-8. Money laundering and confiscation
9-23. Customer due diligence, reporting, and prevention
24-25. Transparency of legal persons and arrangements
26-35. Powers and responsibilities of competent authorities
36-40. International cooperation

RISK-BASED APPROACH:
- Higher risk: Apply enhanced measures (EDD, senior management approval, increased monitoring)
- Standard risk: Apply standard CDD measures
- Lower risk: Simplified measures may be appropriate
- Customer risk factors: type, geography, delivery channel, products/services
- Country risk factors: FATF lists, Transparency International CPI, sanctions

HIGH-RISK INDICATORS FOR TRANSACTION MONITORING:
1. Transactions involving grey/blacklist countries
2. Use of shell companies or complex ownership structures
3. Cash-intensive businesses (restaurants, car washes, convenience stores)
4. Trade-based money laundering (over/under-invoicing, phantom shipments)
5. Rapid movement of funds through multiple accounts
6. Unusual use of offshore financial centers
7. Transactions inconsistent with customer profile
8. Large wire transfers to/from high-risk jurisdictions
9. Use of anonymous instruments or virtual assets
10. Politically exposed persons without enhanced due diligence`,
  },
  {
    source_type: "regulation",
    source_name: "Card Network Dispute Rules — Visa and Mastercard",
    content: `Card Network Chargeback and Dispute Rules

VISA DISPUTE RULES (Visa Core Rules, effective 2024)

Dispute Categories:
- Fraud (10.x): Unauthorized transactions, counterfeit cards
  * 10.1: EMV Liability Shift — Counterfeit
  * 10.2: EMV Liability Shift — Non-Counterfeit
  * 10.3: Other Fraud — Card-Present
  * 10.4: Other Fraud — Card-Absent
  * 10.5: Visa Fraud Monitoring Program
- Authorization (11.x): No authorization, declined authorization
  * 11.1: Card Recovery Bulletin
  * 11.2: Declined Authorization
  * 11.3: No Authorization
- Processing Errors (12.x): Incorrect amount, duplicate processing
  * 12.1: Late Presentment
  * 12.2: Incorrect Transaction Code
  * 12.3: Incorrect Currency
  * 12.4: Incorrect Account Number
  * 12.5: Incorrect Amount
  * 12.6: Duplicate Processing / Paid by Other Means
  * 12.7: Invalid Data
- Consumer Disputes (13.x): Goods not received, not as described
  * 13.1: Merchandise / Services Not Received
  * 13.2: Cancelled Recurring Transaction
  * 13.3: Not as Described / Defective
  * 13.4: Counterfeit Merchandise
  * 13.5: Misrepresentation
  * 13.6: Credit Not Processed
  * 13.7: Cancelled Services

Timeframes:
- Cardholder dispute filing: 120 days from transaction date (or expected delivery date)
- Issuer to acquirer: 120 days from transaction processing date
- Acquirer representment: 30 days from dispute receipt
- Pre-arbitration: 30 days
- Arbitration filing: 10 days from pre-arbitration response

Compelling Evidence 3 (CE3):
- Allows merchants to submit prior undisputed transaction evidence
- Requirements: 2+ prior undisputed transactions from same payment credentials AND (same device ID or same IP address) within 120 days before the disputed transaction
- Effect: Liability shifts back to issuer even for fraud disputes
- This is a game-changer for ecommerce merchants with returning customers

Rapid Dispute Resolution (RDR):
- Automated resolution through Verifi platform
- Merchant pre-authorizes resolution for qualifying disputes
- Prevents chargeback from being filed
- Available for disputes under specific thresholds

MASTERCARD DISPUTE RULES

Chargeback Reason Codes:
- Fraud (4837, 4863, 4871): Unauthorized use, chip liability shift
  * 4837: No Cardholder Authorization
  * 4863: Cardholder Does Not Recognize
  * 4871: Chip/PIN Liability Shift
- Authorization (4807, 4808, 4812): Warning bulletin, authorization errors
- Point of Interaction (4834): Duplicate processing, late presentment
- Cardholder Disputes (4853, 4855, 4859):
  * 4853: Cardholder Dispute — Goods/Services Not Delivered
  * 4855: Goods or Services Not as Described
  * 4859: Addendum Dispute

Timeframes:
- Chargeback filing: 120 days from transaction date
- Representment: 45 days from chargeback
- Second chargeback (arbitration): 45 days from representment

Mastercard Ethoca:
- Real-time confirmed fraud alerts
- Merchant receives alert when fraud is confirmed, can issue refund before chargeback
- Significantly reduces chargeback volume
- Collaboration framework for merchant-issuer communication

AMERICAN EXPRESS DISPUTE RULES:
- Inquiry period: 20 days for merchant response
- Chargeback: If no response to inquiry or response insufficient
- Timeframe: Generally 120 days from transaction date
- Full recourse model — Amex can charge back to merchant at any time for fraud`,
  },
];

// Agent-specific knowledge
const TRANSACTION_MONITOR_KNOWLEDGE = [
  {
    source_type: "knowledge",
    source_name: "Transaction Monitoring — Typologies and Red Flags",
    content: `Transaction Monitoring Typologies and Red Flags

MONEY LAUNDERING STAGES:
1. Placement: Introducing illicit funds into the financial system
   - Cash deposits below reporting thresholds (structuring/smurfing)
   - Purchasing monetary instruments (money orders, cashier's checks)
   - Commingling illicit funds with legitimate business revenue

2. Layering: Disguising the trail of illicit funds
   - Multiple wire transfers between accounts
   - Conversion between currencies
   - Purchase and sale of financial instruments
   - Use of shell companies and nominee accounts
   - Trade-based money laundering

3. Integration: Reintroducing laundered funds into the legitimate economy
   - Real estate purchases
   - Luxury goods purchases
   - Business investments
   - Loan-back schemes

STRUCTURING TYPOLOGIES:
Pattern 1 — Below-Threshold Deposits:
- Multiple cash deposits of $9,000-$9,999 across different days
- Using different branches of the same bank
- Depositing just below $10,000 on consecutive days
- Average transaction 85-99% of CTR threshold

Pattern 2 — Split Deposits:
- Customer deposits $5,000 at Branch A and $4,900 at Branch B on same day
- Uses different tellers or ATMs
- May use different account numbers

Pattern 3 — Third-Party Structuring:
- Customer sends multiple people to make deposits into their account
- Each deposit below threshold
- "Smurfs" may not know the purpose of the deposits

Pattern 4 — Funnel Accounts:
- Multiple deposits from different cities into single account
- Followed by large wire transfer to another country
- Common in drug trafficking organizations

VELOCITY-BASED RED FLAGS:
- More than 5 transactions per 24-hour period for individual accounts
- More than 20 transactions per 7-day period
- Sudden increase in transaction frequency after period of dormancy (>30 days)
- 3+ transactions within 1 hour (burst pattern)
- Significantly increased average transaction size within short period

AMOUNT-BASED RED FLAGS:
- Transactions just below CTR threshold ($10,000 US, €15,000 EU, ₹10 lakh India)
- Round-figure amounts >$5,000 (indicative of structuring)
- Transactions significantly above customer's historical average (>2 standard deviations)
- Micro-deposits followed by large withdrawals (cuckoo smurfing)
- Amounts that are exact multiples (layering indicator)

GEOGRAPHIC RED FLAGS:
- IP address country does not match customer's country of residence
- Transactions involving FATF grey or blacklist countries
- High-risk corridors (narcotics routes, sanctions evasion routes)
- Free trade zones (Dubai, Singapore, Panama — reduced regulatory oversight)
- Multiple transactions to different beneficiaries in same high-risk country
- Impossible travel: transactions from physically impossible locations given timing

TEMPORAL RED FLAGS:
- Transactions between 1:00 AM and 5:00 AM local time
- Weekend transactions for business accounts
- Transactions clustered just before or after reporting periods
- Regular cadence suggesting automated transactions (bot-like behavior)
- Transactions timed to coincide with market close or settlement windows

CUSTOMER PROFILE RED FLAGS:
- PEP status without enhanced monitoring
- Customer in cash-intensive business (restaurants, convenience stores, car washes)
- Customer recently changed risk classification
- Account opened <6 months with sudden high-value activity
- Customer's stated income inconsistent with transaction volumes
- Multiple accounts with similar activity patterns (layering)`,
  },
];

const CHARGEBACK_KNOWLEDGE = [
  {
    source_type: "knowledge",
    source_name: "Chargeback Analysis — Fraud Dimensions and Strategy",
    content: `Chargeback Analysis — Fraud Detection Dimensions and Strategy

FRIENDLY FRAUD vs. TRUE FRAUD:
Friendly Fraud (First-Party Fraud):
- Cardholder made the purchase but claims they didn't
- Common in subscription services, digital goods, family sharing
- Indicators: matching address, device fingerprint, prior purchase history
- Defense: Compelling Evidence 3, delivery confirmation, usage logs

True Fraud (Third-Party Fraud):
- Card was genuinely used without authorization
- Stolen card, data breach, account takeover
- Indicators: unusual location, new device, address mismatch
- Defense: 3DS authentication, device intelligence, biometric verification

AUTHENTICATION EVIDENCE:
3D Secure Analysis:
- 3DS 2.x with ECI 05: Fully authenticated — strongest merchant defense
  * Liability shifts to issuer for fraud disputes
  * Challenge flow completed successfully
  * Both issuer and cardholder verified the transaction
- 3DS 2.x with ECI 06: Attempted but not completed
  * Issuer may not support 3DS or cardholder dropped off
  * Partial liability protection in some networks
- 3DS 1.0 with ECI 05/06: Legacy authentication
  * Still provides liability shift but less robust
- No 3DS: Merchant bears full fraud liability
  * Should be flagged in analysis
  * Significantly weakens merchant's representment case

AVS (Address Verification Service):
- Full match (Y/Y): Strong indicator of legitimate transaction
- Partial match: Moderate indicator
- No match (N/N): Red flag, should increase risk score
- Not available: Cannot be used as evidence, score as neutral

CVV/CVC:
- Match: Cardholder had physical access to card or card data
- No match: Strong indicator of fraud
- Not provided: Cannot be used as defense

DELIVERY EVIDENCE:
For Physical Goods:
- Signed delivery confirmation: Strongest evidence
- Tracking showing delivered to billing address: Strong evidence
- Tracking showing delivered to different address: Investigate
- No tracking: Weak merchant position

For Digital Goods:
- IP address matching cardholder location: Good indicator
- Account access logs showing usage after purchase: Strong evidence
- Download confirmation: Moderate evidence
- No usage data: Weak merchant position

REPRESENTMENT STRATEGY:
When to Represent:
- Expected Value (EV) calculation: EV = P(win) × dispute_amount - representment_cost - penalty_if_loss
- Only represent if EV > 0
- Consider: win rate for reason code, evidence strength, amount, time investment

Compelling Evidence Package:
1. Transaction receipt/invoice
2. Authentication proof (3DS log, ECI value)
3. AVS and CVV match confirmation
4. Delivery confirmation with signature
5. Prior undisputed transactions (CE3 for Visa)
6. Customer communication records
7. IP address and device information
8. Refund/cancellation policy acceptance proof

Pre-Arbitration Considerations:
- Visa: $500 filing fee (refunded if merchant wins)
- Mastercard: Varies by region
- Should only proceed if strong evidence and high-value dispute
- Timeline: 10 days (Visa), 45 days (Mastercard)`,
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log("🔐 Getting admin token...");
  const token = await getAdminToken();
  console.log("✓ Authenticated\n");

  let totalChunks = 0;

  // Shared knowledge (available to all agents)
  console.log("📚 Seeding shared knowledge base...");
  for (const doc of SHARED_KNOWLEDGE) {
    totalChunks += await ingest(token, { ...doc, agent_id: undefined });
  }

  // Transaction Monitor specific
  console.log("\n🔍 Seeding Transaction Monitor knowledge...");
  // First get the agent ID
  const agentsRes = await fetch(`${API_BASE}/agents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const agents = await agentsRes.json() as Array<{ id: string; slug: string }>;
  const txMonitor = agents.find((a) => a.slug === "transaction-monitor");
  const cbAgent = agents.find((a) => a.slug === "chargeback-validity");

  if (txMonitor) {
    for (const doc of TRANSACTION_MONITOR_KNOWLEDGE) {
      totalChunks += await ingest(token, { ...doc, agent_id: txMonitor.id });
    }
  }

  if (cbAgent) {
    console.log("\n🛡️ Seeding Chargeback Validity knowledge...");
    for (const doc of CHARGEBACK_KNOWLEDGE) {
      totalChunks += await ingest(token, { ...doc, agent_id: cbAgent.id });
    }
  }

  console.log(`\n✅ Done! Total chunks inserted: ${totalChunks}`);
}

main().catch(console.error);
