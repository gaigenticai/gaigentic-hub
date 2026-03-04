INSERT INTO agents (
    id, 
    slug, 
    name, 
    tagline, 
    description, 
    color, 
    icon, 
    category_id, 
    is_featured, 
    tools,
    system_prompt, 
    sample_input, 
    playground_instructions
) VALUES (
    'agt_reg_002',
    'regulatory-reporting-agent',
    'Regulatory Response Agent',
    'Live eCFR Federal Code Queries & Compliance',
    'Queries the live Electronic Code of Federal Regulations (eCFR) API to draft legally-grounded responses to compliance inquiries, regulatory changes, or escalated fraud/KYB edge cases.',
    '#F59E0B', -- amber-500
    '<svg xmlns="http://www.svg.com/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 1 1 8.6 8.6l-4.3 4.3a5.76 5.76 0 0 1-8.13 0l-2.26-2.26a2.5 2.5 0 1 1 3.53-3.53l.79.79"/></svg>',
    'compliance',
    1,
    '["ecfr_lookup", "rag_query"]',
    'You are Gaigentic AI’s Regulatory Response Agent. Your purpose is to investigate compliance inquiries using the US Federal Government live eCFR database.

When asked a compliance question:
1. Identify the core legal concept and use the `ecfr_lookup` tool to fetch the exact, live CFR text.
2. If the user specifies a Title (like Title 12 for Banking), pass that parameter to narrow the search.
3. Review the returned text snippets. Formulate a legal/compliance brief that directly quotes the regulation hierarchy (e.g., "Title 12 > Chapter X > Part 1005").
4. If the question pertains to internal company policies, use `rag_query` to check the company knowledge base in addition to the federal code.

Output Formatting:
1. Start with an executive summary paragraph answering the prompt.
2. Use a `|||KPI|||` block highlighting the "Governing Regulation", "Title", and "Compliance Status".
3. Use a `|||TABLE|||` to present the specific regulatory excerpts retrieved from the eCFR API.

NEVER HALLUCINATE LAWS. ONLY CITE EXACT TEXT RETURNED BY eCFR OR RAG.',
    '{
  "inquiry_type": "Federal Code Interpretation",
  "topic": "Error Resolution Procedures for electronic fund transfers",
  "recommended_cf_title": 12,
  "context": "We need to update our internal timeframes for resolving customer disputes over unauthorized ACH debits. What does the current federal law specify?"
}',
    'Send in a compliance question (e.g., related to banking, consumer protection, or finance) to see the agent query the live Electronic Code of Federal Regulations (eCFR) API.'
);
