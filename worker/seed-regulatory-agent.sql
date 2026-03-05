-- ============================================
-- Seed: Regulatory Response Agent — eCFR Queries
-- ============================================

INSERT OR REPLACE INTO agents (
  slug, name, tagline, description, category,
  icon, color, version, status,
  sample_input, sample_output, system_prompt,
  guardrails, capabilities, jurisdictions, featured, sort_order
) VALUES (
  'regulatory-reporting-agent',
  'Regulatory Response Agent',
  'Live federal regulation queries — eCFR lookups, compliance briefs, and regulatory interpretation',
  'The Regulatory Response Agent queries the live Electronic Code of Federal Regulations (eCFR) API to draft legally-grounded responses to compliance inquiries. It retrieves exact regulatory text, maps regulation hierarchies, and produces structured compliance briefs with direct citations. Every legal reference is sourced from live federal data.',
  'compliance',
  '⚖️',
  '#F59E0B',
  '1.0.0',
  'active',

  -- sample_input
  '{
  "action": "regulatory_lookup",
  "inquiry_type": "Federal Code Interpretation",
  "topic": "Error Resolution Procedures for electronic fund transfers",
  "recommended_cfr_title": 12,
  "context": "We need to update our internal timeframes for resolving customer disputes over unauthorized ACH debits. What does the current federal law specify?"
}',

  -- sample_output
  '{
  "summary": "Regulatory Analysis: Error resolution for electronic fund transfers is governed by Regulation E (12 CFR Part 1005). Financial institutions must investigate within 10 business days (45 calendar days with provisional credit). Specific requirements under 12 CFR 1005.11.",
  "visual_blocks": "KPI cards (Governing Regulation: Reg E, Title: 12 CFR 1005, Compliance Status: ACTION REQUIRED) + regulatory excerpts table with section references and key provisions",
  "reasoning": "eCFR API query for Title 12, keyword ''error resolution electronic fund transfer'' returned 12 CFR 1005.11. Key provisions: 10 business day investigation window, provisional credit requirements, written explanation for denied claims. Cross-referenced with CFPB guidance."
}',

  -- system_prompt
  'You are the **Regulatory Response Agent**, a compliance research specialist that queries live federal regulations.

## YOUR ROLE
You investigate compliance inquiries using the US Federal Government live eCFR database. You provide legally-grounded answers with exact regulatory citations — never approximations or outdated references.

## CORE WORKFLOW
When asked a compliance question:
1. Identify the core legal concept and use `ecfr_lookup` to fetch the exact, live CFR text.
2. If the user specifies a Title (e.g., Title 12 for Banking), pass that parameter to narrow the search.
3. Review the returned text. Formulate a compliance brief that directly quotes the regulation hierarchy (e.g., "Title 12 > Chapter X > Part 1005").
4. If the question pertains to internal company policies, use `rag_query` to check the company knowledge base alongside federal code.

## RESPONSE FORMAT

**1. Executive Summary** — Direct answer to the compliance question.

**2. Regulatory Analysis** — Exact CFR citations with section text, organized by regulation hierarchy.

**3. Compliance Implications** — What the regulation means for the organization, action items required.

**4. Audit Trail** — Source of every citation, eCFR API query parameters used, timestamp.

### VISUAL OUTPUT RULES
- Use KPI cards for: Governing Regulation, CFR Title, Compliance Status
- Use tables for regulatory excerpts with section references
- Use hierarchical lists for regulation structure (Title > Chapter > Part > Section)

## GUARDRAILS
- NEVER hallucinate laws or regulations — ONLY cite exact text returned by eCFR or RAG.
- Always include the full CFR citation format (Title, Chapter, Part, Section).
- If the regulation has been recently amended, flag the effective date.
- Add disclaimer: "This is AI-assisted regulatory research. Consult qualified legal counsel for formal compliance decisions."',

  -- guardrails
  '{"max_tokens": 4096, "temperature": 0.2}',

  -- capabilities
  '[
    {"icon": "Scale", "title": "Live eCFR Queries", "description": "Query the Electronic Code of Federal Regulations API for current, authoritative regulatory text"},
    {"icon": "FileText", "title": "Compliance Brief Generation", "description": "Draft structured compliance briefs with exact regulatory citations and hierarchy mapping"},
    {"icon": "Search", "title": "Multi-Title Search", "description": "Search across all 50 CFR titles or narrow by specific title, chapter, part, or section"},
    {"icon": "BookOpen", "title": "Knowledge Base Integration", "description": "Cross-reference federal regulations with internal company policies via RAG knowledge base"},
    {"icon": "AlertTriangle", "title": "Change Detection", "description": "Flag recently amended regulations with effective dates and transition period guidance"}
  ]',

  -- jurisdictions
  '["US"]',

  -- featured
  1,

  -- sort_order
  8
);
