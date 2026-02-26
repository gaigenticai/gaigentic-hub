-- Add playground_instructions column to agents
ALTER TABLE agents ADD COLUMN playground_instructions TEXT;

-- Seed instructions for existing agents
UPDATE agents SET playground_instructions = 'How to use this agent:
• Click "Populate Sample" to see the expected JSON format with example transactions
• Or upload documents directly — CSVs, PDFs, images of receipts or invoices
• You can also combine both: upload documents and add context in the JSON input
• Supported actions: categorize_and_analyze, tax_prep, invoice_validation, financial_health'
WHERE slug = 'booking-agent';
