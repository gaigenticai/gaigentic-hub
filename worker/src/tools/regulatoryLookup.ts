/**
 * Regulatory Lookup Tool — Comprehensive AML/CFT, chargeback, and compliance knowledge.
 * Uses RAG first, falls back to extensive built-in regulatory database.
 */

import type { ToolDefinition } from "./types";
import { queryKnowledge } from "../rag";

export const regulatoryLookupTool: ToolDefinition = {
  name: "regulatory_lookup",
  description:
    "Look up specific regulations, compliance rules, and legal requirements by jurisdiction (US, EU, India). Covers AML/CFT thresholds, filing requirements, chargeback rules, consumer protection, sanctions, and card network policies.",
  category: "compliance",
  stepType: "data_fetch",
  parameters: {
    jurisdiction: {
      type: "string",
      description: 'Jurisdiction code: "US", "EU", "IN", or "ALL"',
      required: true,
    },
    topic: {
      type: "string",
      description:
        "The regulatory topic to look up, e.g. 'CTR thresholds', 'SAR filing requirements', 'structuring laws', 'PSD2 SCA', 'chargeback time limits'",
      required: true,
    },
    network: {
      type: "string",
      description:
        'Optional card network filter: "Visa", "Mastercard", "Amex", "Discover"',
    },
  },
  async execute(params, env, context) {
    const jurisdiction = params.jurisdiction as string;
    const topic = params.topic as string;
    const network = params.network as string | undefined;

    // Try RAG first
    const queryParts = [topic];
    if (jurisdiction !== "ALL") queryParts.push(`jurisdiction:${jurisdiction}`);
    if (network) queryParts.push(`network:${network}`);

    let ragResults: Array<{ content: string; source: string; relevance: string }> = [];
    try {
      const results = await queryKnowledge(env, {
        query: queryParts.join(" "),
        agentId: context.agentId,
        topK: 5,
        scoreThreshold: 0.6,
      });
      ragResults = results.map((r) => ({
        content: r.content,
        source: r.source_name,
        relevance: Math.round(r.score * 100) + "%",
      }));
    } catch {
      // RAG unavailable, use built-in
    }

    // Always supplement with built-in knowledge
    const builtIn = getBuiltInRegulations(jurisdiction, topic, network);

    const combined = {
      jurisdiction,
      topic,
      rag_results: ragResults,
      regulatory_framework: builtIn,
    };

    const sourceCount = ragResults.length + (builtIn ? 1 : 0);
    const sources = ragResults.length > 0 ? `${ragResults.length} RAG entries + built-in` : "built-in regulatory database";

    return {
      success: true,
      data: combined,
      summary: `Found ${sourceCount} regulatory references for ${jurisdiction}: ${topic} (${sources})`,
    };
  },
};

function getBuiltInRegulations(
  jurisdiction: string,
  topic: string,
  network?: string,
): Record<string, unknown> | null {
  const t = topic.toLowerCase();
  const results: Record<string, unknown> = {};

  // ── US Regulations ──
  if (jurisdiction === "US" || jurisdiction === "ALL") {
    if (t.includes("ctr") || t.includes("currency transaction") || t.includes("threshold") || t.includes("reporting")) {
      results.US_CTR = {
        regulation: "Bank Secrecy Act (BSA) — 31 CFR 1010.311",
        threshold: "$10,000 for cash transactions",
        requirement: "Financial institutions must file CTR for cash transactions exceeding $10,000",
        aggregation: "Multiple cash transactions by or on behalf of the same person totaling >$10,000 in one business day must be aggregated",
        filing_deadline: "15 days after the transaction",
        penalties: "Civil penalty up to $25,000 per violation; criminal penalty up to $250,000 and/or 5 years imprisonment",
        exemptions: "Certain customers (banks, government agencies, listed companies) may be exempt via CTR exemption form (FinCEN 110)",
      };
    }
    if (t.includes("sar") || t.includes("suspicious") || t.includes("filing")) {
      results.US_SAR = {
        regulation: "BSA — 31 CFR 1020.320",
        threshold: "$5,000 for banks; $2,000 for money services businesses (MSBs)",
        requirement: "File SAR for transactions that are suspicious, regardless of amount if terrorism-related",
        filing_deadline: "30 days after initial detection; 60 days if no suspect identified",
        confidentiality: "SAR filings are strictly confidential — it is a federal crime to disclose that a SAR has been filed",
        duration: "Continue monitoring for 90 days after SAR filing",
        joint_filing: "FinCEN 314(b) allows voluntary information sharing between financial institutions",
      };
    }
    if (t.includes("structuring") || t.includes("smurfing")) {
      results.US_STRUCTURING = {
        regulation: "31 USC §5324 — Structuring Transactions to Evade Reporting",
        definition: "Breaking up transactions to avoid CTR filing thresholds",
        criminal_offense: true,
        penalties: "Up to $250,000 fine and/or 5 years imprisonment per offense",
        indicators: [
          "Multiple cash deposits/withdrawals just below $10,000",
          "Multiple transactions at different branches on same day",
          "Customer expresses awareness of CTR requirements",
          "Transactions inconsistent with customer's normal activity",
          "Use of multiple accounts to stay below thresholds",
        ],
        case_law: "United States v. Rybicki (2002) — structuring is a crime regardless of whether the underlying funds are legally obtained",
      };
    }
    if (t.includes("reg e") || t.includes("efta") || t.includes("electronic fund") || t.includes("consumer")) {
      results.US_REG_E = {
        regulation: "Regulation E (12 CFR Part 1005) — Electronic Fund Transfer Act",
        consumer_liability: {
          within_2_days: "$50 maximum liability",
          within_60_days: "$500 maximum liability",
          after_60_days: "Full liability for unauthorized transfers",
        },
        bank_investigation: "10 business days (20 for new accounts)",
        provisional_credit: "Must provide if investigation exceeds 10 business days",
        resolution_deadline: "45 days (90 days for new accounts, international, or POS transactions)",
      };
    }
    if (t.includes("reg z") || t.includes("tila") || t.includes("credit card") || t.includes("chargeback") || t.includes("dispute")) {
      results.US_REG_Z = {
        regulation: "Regulation Z (12 CFR Part 1026) — Truth in Lending Act",
        consumer_liability: "$50 maximum for unauthorized credit card charges",
        zero_liability: "Most networks offer zero liability policies beyond Reg Z requirements",
        billing_error_deadline: "60 days from statement date",
        issuer_investigation: "Must resolve within 2 billing cycles (max 90 days)",
        provisional_credit: "Issuer must credit disputed amount during investigation",
      };
    }
    if (t.includes("ofac") || t.includes("sanction")) {
      results.US_OFAC = {
        regulation: "Office of Foreign Assets Control (OFAC) — 31 CFR Part 501",
        requirement: "All US persons must screen transactions against SDN (Specially Designated Nationals) list",
        screening: "Real-time screening required for all wire transfers",
        blocking: "Must freeze/block transactions involving sanctioned persons or countries",
        reporting: "Must file blocking report within 10 business days",
        penalties: "Civil penalty up to $356,579 per violation; criminal penalty up to $20 million and 30 years imprisonment",
        sanctioned_countries: ["Cuba", "Iran", "North Korea", "Syria", "Crimea region"],
      };
    }
    if (t.includes("fatf") || t.includes("high risk") || t.includes("grey") || t.includes("black")) {
      results.FATF = {
        organization: "Financial Action Task Force",
        grey_list_2024: ["Bulgaria", "Burkina Faso", "Cameroon", "Croatia", "Congo", "Haiti", "Kenya", "Mali", "Monaco", "Mozambique", "Namibia", "Nigeria", "South Africa", "South Sudan", "Syria", "Tanzania", "Venezuela", "Vietnam", "Yemen"],
        black_list_2024: ["Iran", "Myanmar", "North Korea"],
        requirement: "Enhanced Due Diligence (EDD) required for transactions involving grey/black list countries",
        impact: "Higher risk weighting in transaction monitoring models",
      };
    }
  }

  // ── EU Regulations ──
  if (jurisdiction === "EU" || jurisdiction === "ALL") {
    if (t.includes("amld") || t.includes("anti-money") || t.includes("aml") || t.includes("threshold") || t.includes("reporting")) {
      results.EU_AMLD = {
        regulation: "4th/5th/6th Anti-Money Laundering Directives",
        cdd_threshold: "€15,000 for occasional transactions",
        reporting: "Suspicious Transaction Reports (STRs) to national Financial Intelligence Units (FIUs)",
        edd_triggers: ["PEPs", "High-risk third countries", "Complex/unusual transactions", "Correspondent banking"],
        beneficial_ownership: "Ultimate Beneficial Owner (UBO) must be identified for all business relationships",
        sixth_amld: {
          criminal_liability: "Extended to legal persons (companies)",
          predicate_offenses: "Harmonized list of 22 predicate offenses across EU",
          penalties: "Minimum 4 years imprisonment for money laundering",
        },
      };
    }
    if (t.includes("sca") || t.includes("psd2") || t.includes("authentication") || t.includes("strong customer")) {
      results.EU_PSD2_SCA = {
        regulation: "Payment Services Directive 2 (PSD2) — Strong Customer Authentication",
        requirement: "Two of three factors: knowledge (password), possession (phone), inherence (biometric)",
        threshold: "Required for electronic payments",
        exemptions: {
          low_value: "Transactions under €30 (cumulative limit: €100 or 5 transactions)",
          low_risk: "Transaction Risk Analysis (TRA) exemption based on fraud rates",
          recurring: "Fixed-amount recurring payments to same payee after first authentication",
          trusted_beneficiary: "Customer-whitelisted payees",
          corporate: "Secure corporate payment processes",
        },
        liability_shift: "If merchant performed SCA, liability shifts to issuer for disputed transaction",
        non_compliance: "Without SCA, merchant bears full liability for fraudulent transactions",
      };
    }
    if (t.includes("gdpr") || t.includes("data") || t.includes("privacy")) {
      results.EU_GDPR = {
        regulation: "General Data Protection Regulation (GDPR)",
        relevance: "AML data must be processed under legal obligation basis (Art. 6(1)(c))",
        retention: "AML records must be kept 5 years after business relationship ends",
        data_minimization: "Only collect data necessary for AML compliance",
        cross_border: "Standard Contractual Clauses (SCCs) required for transfers outside EU/EEA",
      };
    }
  }

  // ── India Regulations ──
  if (jurisdiction === "IN" || jurisdiction === "ALL") {
    if (t.includes("pmla") || t.includes("prevention of money") || t.includes("aml") || t.includes("threshold") || t.includes("reporting")) {
      results.IN_PMLA = {
        regulation: "Prevention of Money Laundering Act, 2002 (PMLA)",
        ctr_threshold: "₹10,00,000 (₹10 lakh) for cash transactions",
        str_threshold: "No monetary threshold — any suspicious transaction must be reported",
        filing_body: "Financial Intelligence Unit — India (FIU-IND)",
        filing_deadline: "15 days for STR; monthly for CTR",
        record_keeping: "10 years from date of transaction",
        penalties: "Rigorous imprisonment 3-7 years; attachment and confiscation of property",
      };
    }
    if (t.includes("rbi") || t.includes("kyc") || t.includes("customer due")) {
      results.IN_RBI_KYC = {
        regulation: "RBI Master Direction on KYC (2016, updated 2023)",
        cdd_requirements: "Aadhaar/PAN-based verification for all accounts",
        risk_categories: ["Low", "Medium", "High"],
        edd_triggers: ["PEPs", "High-risk countries", "Non-face-to-face accounts", "Unusual transactions"],
        periodic_review: "Low risk: 10 years, Medium: 8 years, High: 2 years",
        video_kyc: "Permitted for account opening since 2020",
      };
    }
    if (t.includes("fema") || t.includes("foreign exchange") || t.includes("cross-border") || t.includes("wire")) {
      results.IN_FEMA = {
        regulation: "Foreign Exchange Management Act, 1999 (FEMA)",
        liberalised_remittance: "LRS limit: $250,000 per financial year for resident individuals",
        reporting: "All cross-border transactions must be reported to RBI",
        prohibited_transactions: ["Real estate outside India (except for education/business)", "Margin trading abroad", "Lottery/betting/gambling"],
      };
    }
    if (t.includes("dispute") || t.includes("chargeback") || t.includes("unauthorized") || t.includes("liability")) {
      results.IN_RBI_DISPUTES = {
        regulation: "RBI Circular on Limiting Liability (2017/2019)",
        zero_liability: "If reported within 3 working days of receiving notification",
        limited_liability: "₹5,000 to ₹25,000 if reported between 4-7 working days",
        full_liability: "Customer bears full loss if reported after 7 working days",
        bank_resolution: "Must resolve within 90 days",
        credit_timeline: "Shadow/provisional credit within 10 working days (T+10)",
        upi_disputes: "NPCI Dispute Resolution Mechanism — 30-day resolution timeline",
      };
    }
  }

  // ── US Lending Regulations ──
  if (jurisdiction === "US" || jurisdiction === "ALL") {
    if (t.includes("tila") || t.includes("truth in lending") || t.includes("lending") || t.includes("loan") || t.includes("apr") || t.includes("disclosure")) {
      results.US_TILA = {
        regulation: "Truth in Lending Act (TILA) — Regulation Z (12 CFR Part 1026)",
        requirement: "Lenders must disclose APR, finance charges, total of payments, and payment schedule before loan consummation",
        rescission_right: "3 business days right of rescission for refinances and HELOCs on primary residence",
        advertising: "Triggering terms (specific rate/payment/term) require full disclosure of all terms",
        penalties: "Civil liability: actual damages + statutory damages up to $5,000 individual / $500,000 class action",
        hoepa: "High-cost mortgage triggers (APR > 6.5% above APOR for first liens) require additional protections",
      };
    }
    if (t.includes("ecoa") || t.includes("equal credit") || t.includes("discrimination") || t.includes("fair lending")) {
      results.US_ECOA = {
        regulation: "Equal Credit Opportunity Act (ECOA) — Regulation B (12 CFR Part 1002)",
        prohibited_bases: ["race", "color", "religion", "national origin", "sex", "marital status", "age", "receipt of public assistance"],
        adverse_action: "Must provide notice within 30 days with specific reasons for denial",
        record_keeping: "25 months for applications; 12 months for credit monitoring records",
        penalties: "Actual damages + punitive damages up to $10,000 individual / $500,000 class action",
      };
    }
    if (t.includes("respa") || t.includes("real estate") || t.includes("mortgage") || t.includes("closing")) {
      results.US_RESPA = {
        regulation: "Real Estate Settlement Procedures Act (RESPA) — Regulation X",
        loan_estimate: "Must be provided within 3 business days of application",
        closing_disclosure: "Must be provided 3 business days before closing",
        prohibitions: ["Kickbacks/referral fees", "Excessive escrow deposits", "Seller-required title insurance"],
        servicing_rules: "Transfer notice 15 days before, error resolution within 30 days",
      };
    }
    if (t.includes("fdcpa") || t.includes("debt collection") || t.includes("collections") || t.includes("collector")) {
      results.US_FDCPA = {
        regulation: "Fair Debt Collection Practices Act (FDCPA) — 15 USC §1692 + Regulation F (12 CFR §1006)",
        call_limits: "Maximum 7 calls per 7 days per debt per phone number; 1 call per day to same number",
        time_window: "8:00 AM - 9:00 PM in consumer's local time zone",
        validation_notice: "Within 5 days of first contact: amount, creditor name, itemization, 30-day dispute window",
        cease_communication: "Must honor written cease requests — continued contact is a violation",
        voicemail: "Only: collector name, callback request, phone number. No mention of 'debt'",
        sms_email: "SMS requires prior consent + 'Reply STOP'; email max 1/day with opt-out mechanism",
        time_barred_debts: "Cannot sue or threaten to sue on statute-of-limitations-expired debts",
        penalties: "Up to $1,000 per violation + attorney fees; TCPA: $500-$1,500 per call/text",
        state_variations: {
          WA: "3 calls per 7 days",
          MA: "2 calls per 7 days",
          NY: "4 calls per 7 days",
          CA: "5 calls per 7 days",
        },
      };
    }
  }

  // ── India Lending & Collections ──
  if (jurisdiction === "IN" || jurisdiction === "ALL") {
    if (t.includes("lending") || t.includes("loan") || t.includes("rbi lending") || t.includes("interest rate") || t.includes("nbfc")) {
      results.IN_RBI_LENDING = {
        regulation: "RBI Master Direction on Regulatory Framework for Microfinance Loans + Fair Practices Code",
        interest_rate_cap: "Microfinance: pricing cap based on cost of funds + margin. NBFCs must disclose all-in cost",
        income_verification: "Household income verification mandatory for all retail loans",
        dti_limit: "EMI/NMI ratio should not exceed 50% for microfinance; guidelines vary for other products",
        prepayment: "No prepayment penalty allowed on floating rate loans",
        digital_lending: "RBI Digital Lending Guidelines 2022: all disbursements/repayments through borrower's bank account only",
        loan_agreement: "Must provide Key Fact Statement (KFS) with all-inclusive APR before sanctioning",
        cooling_off: "3-day look-up period for digital loans — borrower can exit without penalty",
      };
    }
    if (t.includes("npa") || t.includes("non performing") || t.includes("provision") || t.includes("write off") || t.includes("collection") || t.includes("recovery")) {
      results.IN_RBI_NPA = {
        regulation: "RBI Master Circular on IRAC Norms (Income Recognition and Asset Classification)",
        npa_classification: "90+ DPD = NPA (Non-Performing Asset)",
        stages: {
          standard: "0-89 DPD — 0.40% provision",
          sub_standard: "90-365 DPD — 15% provision (25% for unsecured)",
          doubtful_1: "12-24 months — 25% provision + 100% of unsecured portion",
          doubtful_2: "24-36 months — 40% provision + 100% of unsecured portion",
          doubtful_3: "36+ months — 100% provision",
          loss: "Uncollectible — 100% provision",
        },
        recovery_channels: ["SARFAESI Act (secured assets)", "DRT (Debt Recovery Tribunal)", "Lok Adalat (up to ₹20 lakh)", "IBC (Insolvency & Bankruptcy Code)"],
        collection_hours: "8 AM - 7 PM only",
        prohibited: ["Physical force", "Coercion", "Abusive language", "Workplace visits (unless requested)", "Third-party disclosure"],
        rbi_ombudsman: "Borrower can file complaint with RBI Ombudsman for collection harassment",
      };
    }
  }

  // ── EU Lending & Collections ──
  if (jurisdiction === "EU" || jurisdiction === "ALL") {
    if (t.includes("lending") || t.includes("consumer credit") || t.includes("mortgage") || t.includes("ccd")) {
      results.EU_CCD = {
        regulation: "Consumer Credit Directive (CCD) 2008/48/EC + Mortgage Credit Directive 2014/17/EU",
        pre_contractual: "Standard European Consumer Credit Information (SECCI) form required",
        aprc: "Annual Percentage Rate of Charge (APRC) must be disclosed — EU harmonized calculation",
        right_of_withdrawal: "14 calendar days withdrawal right for consumer credit",
        creditworthiness: "Mandatory creditworthiness assessment before granting credit",
        early_repayment: "Consumer right to early repayment; compensation limited to 1% (0.5% if < 1 year remaining)",
        responsible_lending: "Prohibition of credit granted solely based on property value without repayment capacity assessment",
      };
    }
    if (t.includes("collection") || t.includes("debt") || t.includes("recovery")) {
      results.EU_DEBT_COLLECTION = {
        framework: "No single EU debt collection directive — governed by national laws + GDPR",
        gdpr_impact: "Debtor data processing requires legal basis; data minimization applies; right to contest automated decisions",
        cross_border: "European Order for Payment (EOP) for cross-border claims up to any amount",
        statute_of_limitations: "Varies by country: France 5 years, Germany 3 years, UK 6 years, Spain 5 years",
        unfair_practices: "Unfair Commercial Practices Directive 2005/29/EC applies to debt collection conduct",
      };
    }
  }

  // ── Card Network Rules ──
  if (network || t.includes("visa") || t.includes("mastercard") || t.includes("amex") || t.includes("network")) {
    if (!network || network === "Visa" || t.includes("visa")) {
      results.VISA_RULES = {
        dispute_timeframe: "120 days from transaction date (or expected delivery date for goods)",
        response_deadline: "30 days from case creation for representment",
        compelling_evidence_3: {
          description: "Visa CE3 allows merchants to submit prior undisputed transaction evidence",
          requirement: "2+ prior undisputed transactions from same device/IP within 120 days",
          effect: "Shifts liability back to issuer even for fraud disputes",
        },
        rapid_dispute_resolution: "VROL/RDR: automated resolution for qualifying disputes under $25",
        dispute_categories: ["Fraud (10.x)", "Authorization (11.x)", "Processing Errors (12.x)", "Consumer Disputes (13.x)"],
      };
    }
    if (!network || network === "Mastercard" || t.includes("mastercard")) {
      results.MASTERCARD_RULES = {
        dispute_timeframe: "120 days from transaction date",
        response_deadline: "45 days for representment",
        collaboration: "Mastercard Collaboration framework for merchant-issuer resolution",
        ethoca: "Real-time alert system for confirmed fraud — prevents chargebacks",
        chargeback_categories: ["Fraud (4837, 4863)", "Authorization (4808)", "Point-of-Interaction (4834)", "Cardholder Disputes (4853, 4855)"],
      };
    }
  }

  return Object.keys(results).length > 0 ? results : null;
}
