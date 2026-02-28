import { Hono } from "hono";
import type { Env, RagDocumentRow } from "../types";
import { isAdmin } from "../adminAuth";
import { ingestDocument } from "../rag";

const rag = new Hono<{ Bindings: Env }>();

// Admin middleware
rag.use("*", async (c, next) => {
  if (!(await isAdmin(c))) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

// POST /rag/ingest — Ingest document into knowledge base
rag.post("/ingest", async (c) => {
  const body = await c.req.json<{
    agent_id?: string;
    source_type: string;
    source_name: string;
    content: string;
    metadata?: Record<string, string>;
  }>();

  if (!body.source_type || !body.source_name || !body.content) {
    return c.json({ error: "source_type, source_name, and content are required" }, 400);
  }

  const result = await ingestDocument(c.env, {
    agentId: body.agent_id || null,
    sourceType: body.source_type,
    sourceName: body.source_name,
    content: body.content,
    metadata: body.metadata,
  });

  return c.json({ success: true, chunks_inserted: result.chunks_inserted });
});

// GET /rag/documents — List all RAG documents
rag.get("/documents", async (c) => {
  const agentId = c.req.query("agent_id");

  let query =
    "SELECT id, agent_id, source_type, source_name, chunk_index, vector_id, created_at FROM rag_documents";
  const binds: string[] = [];

  if (agentId) {
    query += " WHERE agent_id = ?";
    binds.push(agentId);
  }

  query += " ORDER BY created_at DESC LIMIT 200";

  const stmt = binds.length
    ? c.env.DB.prepare(query).bind(...binds)
    : c.env.DB.prepare(query);

  const result = await stmt.all<RagDocumentRow>();
  return c.json({ documents: result.results });
});

// DELETE /rag/documents/:id — Remove document + vectors
rag.delete("/documents/:id", async (c) => {
  const id = c.req.param("id");

  // Get vector_id before deleting
  const doc = await c.env.DB.prepare(
    "SELECT vector_id FROM rag_documents WHERE id = ?",
  )
    .bind(id)
    .first<{ vector_id: string | null }>();

  if (!doc) return c.json({ error: "Document not found" }, 404);

  // Delete from D1
  await c.env.DB.prepare("DELETE FROM rag_documents WHERE id = ?")
    .bind(id)
    .run();

  // Delete from Vectorize
  if (doc.vector_id) {
    try {
      await c.env.VECTORIZE.deleteByIds([doc.vector_id]);
    } catch {
      // Vectorize deletion is best-effort
    }
  }

  return c.json({ success: true });
});

// POST /rag/seed — Seed knowledge base (API key auth, bypasses admin middleware)
// This is registered separately in index.ts with API key auth
export async function seedKnowledge(c: { env: Env; req: { header: (name: string) => string | undefined } }) {
  const apiKey = c.req.header("X-Seed-Key");
  // Use admin email as simple auth for one-time seed operation
  if (!apiKey || apiKey !== c.env.ADMIN_EMAIL) {
    return { error: "Unauthorized", status: 401 };
  }

  const results: Array<{ name: string; chunks: number }> = [];

  for (const doc of SEED_DOCUMENTS) {
    const result = await ingestDocument(c.env, {
      agentId: doc.agent_id || null,
      sourceType: doc.source_type,
      sourceName: doc.source_name,
      content: doc.content,
    });
    results.push({ name: doc.source_name, chunks: result.chunks_inserted });
  }

  return { success: true, results, total_chunks: results.reduce((s, r) => s + r.chunks, 0) };
}

const SEED_DOCUMENTS = [
  {
    agent_id: null, // shared
    source_type: "regulation",
    source_name: "US BSA/AML Framework",
    content: `Bank Secrecy Act (BSA) — Anti-Money Laundering Framework. The BSA, enacted in 1970 and amended by the USA PATRIOT Act (2001), is the primary US anti-money laundering law. Currency Transaction Reports (CTR): Filing threshold $10,000 in cash transactions per business day. Aggregation rule: Multiple cash transactions by same person totaling over $10,000 in one business day must be aggregated. Filing deadline: 15 calendar days. Penalties: Civil up to $25,000; criminal up to $250,000 and/or 5 years. Suspicious Activity Reports (SAR): Threshold $5,000 for banks, $2,000 for MSBs. No threshold for terrorism financing. Filing deadline: 30 days after detection; 60 days if no suspect. Confidentiality: Federal crime to disclose SAR filing. Continuing SAR every 90 days. Structuring (31 USC §5324): Breaking transactions to avoid CTR thresholds is a federal crime regardless of fund source. Penalties up to $250,000 and/or 5 years. Indicators: deposits just below $10,000, multiple branches, customer awareness of CTR. FinCEN 314(b): Voluntary info sharing between institutions with Safe Harbor protection.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "US Consumer Protection — Reg E and Reg Z",
    content: `Regulation E (EFTA) — Electronic Fund Transfers. Consumer liability: within 2 business days $50 max, within 60 days $500 max, after 60 days full liability. Bank investigation: 10 business days (20 for new accounts). Provisional credit if investigation exceeds 10 days. Resolution: 45 days (90 for new accounts, international, POS). Regulation Z (TILA) — Credit Cards. Consumer liability: $50 max for unauthorized charges. Most networks offer zero liability. Billing error deadline: 60 days from statement. Issuer resolution: 2 billing cycles max 90 days. Must provide provisional credit during investigation. Cannot report as delinquent during dispute. CFPB oversees enforcement of both regulations.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "EU AML Directives and PSD2/SCA",
    content: `EU Anti-Money Laundering Directives. 4th AMLD: CDD threshold €15,000 for occasional transactions. Beneficial ownership registers mandatory. 5th AMLD: Extends to crypto exchanges, public beneficial ownership, prepaid card threshold €150. 6th AMLD: 22 harmonized predicate offenses, criminal liability for companies, minimum 4 years imprisonment. PSD2 Strong Customer Authentication: Two of three factors required (knowledge, possession, inherence). Exemptions: low value (<€30, cumulative €100), low risk TRA, recurring fixed-amount, trusted beneficiary, corporate. Liability shift: If merchant performed SCA, issuer bears fraud liability. Without SCA, merchant bears liability. GDPR: AML processing lawful under legal obligation. Retention 5 years after relationship ends. Data minimization applies.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "India PMLA and RBI Directions",
    content: `India Prevention of Money Laundering Act (PMLA) 2002. CTR threshold: ₹10 lakh cash transactions. STR: No monetary threshold, any suspicious transaction. Cross-border wire threshold: ₹5 lakh. Filing to FIU-IND: CTR monthly, STR within 15 days. Record keeping: 10 years. Penalties: 3-7 years imprisonment, property confiscation. RBI KYC: Aadhaar/PAN verification, risk categories Low/Medium/High, periodic review 2-10 years. RBI Limiting Liability: Zero liability if reported within 3 working days. Limited liability ₹5,000-₹25,000 for 4-7 days. Full liability after 7 days. Bank must resolve within 90 days, provisional credit within T+10. FEMA: LRS limit $250,000/year, all cross-border transactions reported to RBI.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "FATF Standards and Country Risk Lists",
    content: `Financial Action Task Force (FATF) — International AML/CFT Standards. 40 Recommendations form global framework. Grey List (Increased Monitoring, 2024): Bulgaria, Burkina Faso, Cameroon, Croatia, Congo, Haiti, Kenya, Mali, Monaco, Mozambique, Namibia, Nigeria, South Africa, South Sudan, Syria, Tanzania, Venezuela, Vietnam, Yemen. Implications: Enhanced Due Diligence required, additional scrutiny for correspondent banking. Black List (Call for Action): Iran, Myanmar, North Korea. Implications: Counter-measures required, may prohibit correspondent accounts, automatic escalation. Risk-based approach: Higher risk = EDD + senior management approval. High-risk indicators: shell companies, cash-intensive businesses, trade-based laundering, rapid fund movement, offshore centers, PEPs.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "Card Network Dispute Rules — Visa and Mastercard",
    content: `Visa Dispute Rules. Categories: Fraud (10.x), Authorization (11.x), Processing Errors (12.x), Consumer Disputes (13.x). Key codes: 10.4 Card-Absent Fraud, 13.1 Not Received, 13.3 Not As Described. Timeframes: 120 days filing, 30 days representment, 30 days pre-arbitration. Compelling Evidence 3 (CE3): 2+ prior undisputed transactions from same device/IP within 120 days shifts liability to issuer. Rapid Dispute Resolution via Verifi. Mastercard Rules. Key codes: 4837 No Authorization, 4853 Not Delivered, 4855 Not As Described. Timeframes: 120 days filing, 45 days representment. Ethoca real-time fraud alerts prevent chargebacks. Amex: 20-day inquiry period, 120-day filing, full recourse model.`,
  },
  {
    agent_id: null,
    source_type: "knowledge",
    source_name: "Transaction Monitoring Typologies",
    content: `Money Laundering Stages: 1) Placement — cash deposits below thresholds, monetary instruments, commingling. 2) Layering — wire transfers, currency conversion, shell companies, trade-based laundering. 3) Integration — real estate, luxury goods, business investments, loan-back schemes. Structuring Patterns: below-threshold deposits ($9,000-$9,999), split deposits across branches, third-party smurfs, funnel accounts. Velocity Red Flags: >5 txns/24h, >20 txns/7d, sudden activity after dormancy, 3+ txns within 1 hour, increased average size. Amount Red Flags: near CTR threshold, round figures >$5,000, >2σ above average, micro-deposits then large withdrawal. Geographic Red Flags: IP mismatch, FATF grey/blacklist countries, high-risk corridors, free trade zones, impossible travel. Temporal Red Flags: 1-5 AM transactions, weekend business activity, pre-reporting period clustering, automated cadence.`,
  },
  {
    agent_id: null,
    source_type: "knowledge",
    source_name: "Chargeback Analysis Strategy",
    content: `Friendly Fraud vs True Fraud. Friendly fraud: cardholder made purchase, claims otherwise. Indicators: matching address, device, prior history. Defense: CE3, delivery proof, usage logs. True fraud: genuinely unauthorized. Indicators: unusual location, new device, address mismatch. Defense: 3DS, device intelligence. Authentication Evidence: 3DS 2.x ECI 05 = fully authenticated, strongest defense, liability shifts to issuer. 3DS 2.x ECI 06 = attempted. No 3DS = merchant bears liability. AVS full match = strong legitimate indicator. CVV match = card access evidence. Delivery: signed confirmation strongest, tracking to billing address strong, no tracking weak. Representment: EV = P(win) × amount - cost - penalty. Compelling evidence: receipt, 3DS log, AVS/CVV, delivery, prior transactions (CE3), communications, IP/device data, policy acceptance. Pre-arbitration: Visa $500 fee, Mastercard varies.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "US Lending Laws — TILA, ECOA, RESPA",
    content: `Truth in Lending Act (TILA/Reg Z): Lenders must disclose APR, finance charges, total payments before consummation. HOEPA high-cost mortgage threshold: APR 6.5%+ above APOR for first liens. 3-day right of rescission for refinances/HELOCs on primary residence. Civil liability up to $5,000 individual. Equal Credit Opportunity Act (ECOA/Reg B): Prohibited bases — race, color, religion, national origin, sex, marital status, age, public assistance. Adverse action notice within 30 days with specific reasons. Record keeping 25 months for applications. Punitive damages up to $10,000 individual. RESPA/Reg X: Loan Estimate within 3 business days of application. Closing Disclosure 3 business days before closing. Kickback/referral fee prohibition. QM/ATR Rule: Qualified Mortgage must verify ability to repay — DTI generally ≤43%. Points and fees ≤3% of loan amount. No negative amortization, interest-only, or balloon features.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "India RBI Lending & NBFC Norms",
    content: `RBI Fair Practices Code for Lending: Key Fact Statement (KFS) with all-inclusive APR mandatory before sanctioning. No prepayment penalty on floating rate loans. Digital Lending Guidelines 2022: All disbursements/repayments through borrower bank account only. 3-day look-up period for digital loans. NBFC Scale-Based Regulation: Upper Layer NBFCs must maintain CET1 ratio of 9%. All NBFCs must have Board-approved credit policy. Income Verification: Household income verification mandatory for microfinance. EMI/NMI ratio guideline ≤50% for microfinance. RBI Master Circular on IRAC Norms: NPA = 90+ DPD. Standard provision 0.40%. Sub-standard (90d-12m) provision 15% (25% unsecured). Doubtful-1 (12-24m) 25% + 100% unsecured. Doubtful-2 (24-36m) 40% + 100% unsecured. Doubtful-3 (36m+) 100%. Loss asset 100%. Recovery channels: SARFAESI Act (secured), DRT, Lok Adalat (≤₹20 lakh), IBC.`,
  },
  {
    agent_id: null,
    source_type: "regulation",
    source_name: "US Debt Collection — FDCPA and Regulation F",
    content: `Fair Debt Collection Practices Act (FDCPA) + Regulation F (12 CFR §1006). Call Limits: Maximum 7 calls per 7 days per debt per phone number. Maximum 1 call per day to same number. State variations: WA 3/7d, MA 2/7d, NY 4/7d, CA 5/7d. Time Window: 8:00 AM - 9:00 PM in consumer's local time zone. Validation Notice: Within 5 days of first contact — amount, creditor name, itemization of principal/interest/fees, 30-day dispute window. Cease Communication: Must honor written cease requests immediately. SMS: Prior express written consent required (TCPA). Must include "Reply STOP to opt out." Email: Max 1/day, must include opt-out (honored within 10 business days). Voicemail Safe Harbor: Only collector name, callback request, phone number. No mention of "debt." Time-Barred Debts: Cannot sue or threaten to sue on expired statute of limitations debts. Record Retention: 3 years after last collection activity. Penalties: FDCPA up to $1,000/violation + attorney fees. TCPA $500-$1,500/call or text.`,
  },
  {
    agent_id: null,
    source_type: "knowledge",
    source_name: "Loan Underwriting Methodology",
    content: `Credit Underwriting Five Pillars. 1) Credit Profile: FICO (US) ranges — Excellent 800+, Good 740-799, Fair 670-739, Poor <670. CIBIL (India) — Excellent 800+, Good 750-799, Fair 650-749, Poor <650. Key factors: payment history (35%), amounts owed (30%), credit age (15%), mix (10%), inquiries (10%). 2) Income & Employment: Cross-verify declared income against bank statements and tax returns. Variance >15% = flag. Self-employed require 2+ years ITR. Minimum 1 year salaried employment (2 years self-employed). 3) Debt Capacity: Front-end DTI (housing/income) limits — Conventional 28%, FHA 31%, VA 41%. Back-end DTI (all debt/income) limits — Conventional 36%, FHA 43%, QM 43%. Net disposable should be ≥20% of income. 4) Collateral: LTV limits — Conventional 80% (PMI above), FHA 96.5%, VA 100%. India RBI: 80% for housing. 5) Affordability: EMI formula M=P×r×(1+r)^n/((1+r)^n-1). Interest-to-principal ratio indicates cost burden. Income multiple >5x = elevated risk.`,
  },
  {
    agent_id: null,
    source_type: "knowledge",
    source_name: "Debt Collection Strategy & Recovery Optimization",
    content: `Recovery Rate Benchmarks by DPD. 1-30 DPD: 85% recovery rate, soft reminders, SMS/email/push. 31-60 DPD: 60% recovery, active engagement, payment plan offers. 61-90 DPD: 35% recovery, escalated contact, settlement discussion. 90-180 DPD: 18% recovery, legal notices, credit bureau reporting. 180+ DPD: 8% recovery, litigation/agency referral/debt sale. Propensity-to-Pay Factors: Promise history (strongest predictor — kept/broken ratio), partial payment signals (positive), contact responsiveness, credit score trajectory, employment status, income-to-balance ratio, hardship indicators. Settlement NPV: Settlement now vs extended collection NPV comparison. Discount rate 1%/month for time value. Cost-to-collect 5-15% of recovered amount. Settlement advantage = settlement amount - expected recovery without settlement. Payment Plan Design: Accelerated (3-6 months, minimal waiver), Standard (12 months), Extended/Hardship (18-24 months, 5-15% waiver). Affordable EMI = 30% of income minus existing obligations. Contact Compliance: Always check compliance BEFORE outreach. Violations cost more than the recovery.`,
  },
];

export default rag;
