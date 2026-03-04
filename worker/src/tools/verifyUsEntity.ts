import type { ToolDefinition } from "./types";

export const verifyUsEntityTool: ToolDefinition = {
    name: "verify_us_entity",
    description:
        "Verifies a US corporate entity by checking its registration and filings with the SEC (Securities and Exchange Commission) EDGAR database. Useful for KYB (Know Your Business) onboarding to ensure the business is a real, registered US corporation.",
    category: "compliance",
    stepType: "data_fetch",
    parameters: {
        company_name: {
            type: "string",
            description: "The exact or partial name of the US company to verify (e.g. 'Apple Inc', 'Tesla').",
            required: true,
        },
        ticker_symbol: {
            type: "string",
            description: "Optional. The stock ticker symbol to speed up the lookup (e.g. 'AAPL').",
            required: false,
        },
    },
    async execute(params) {
        const companyName = (params.company_name as string).toLowerCase();
        const ticker = params.ticker_symbol ? (params.ticker_symbol as string).toUpperCase() : null;

        try {
            // The SEC requires a User-Agent string to be declared
            const headers = {
                "User-Agent": "GaigenticHub/1.0 (contact@gaigentic.ai)",
                "Accept": "application/json",
            };

            // 1. Fetch the master ticker list to map name/ticker to CIK
            const tickersRes = await fetch("https://www.sec.gov/files/company_tickers.json", { headers });
            if (!tickersRes.ok) throw new Error("Failed to fetch SEC directory.");

            const tickersData = await tickersRes.json() as Record<string, { cik_str: number; ticker: string; title: string }>;

            let matchedCik: string | null = null;
            let exactName: string | null = null;

            // Find the company
            for (const key of Object.keys(tickersData)) {
                const entry = tickersData[key];
                if (ticker && entry.ticker === ticker) {
                    matchedCik = String(entry.cik_str).padStart(10, '0');
                    exactName = entry.title;
                    break;
                } else if (!ticker && entry.title.toLowerCase().includes(companyName)) {
                    matchedCik = String(entry.cik_str).padStart(10, '0');
                    exactName = entry.title;
                    break; // take first match
                }
            }

            if (!matchedCik) {
                return {
                    success: true,
                    data: {
                        verified: false,
                        reason: `Could not find any SEC EDGAR registration for '${companyName}'.`,
                        searched_name: companyName,
                    },
                    summary: `Entity verification failed: No SEC registration found.`,
                };
            }

            // 2. Fetch the actual company registration data from SEC REST API
            const companyRes = await fetch(`https://data.sec.gov/submissions/CIK${matchedCik}.json`, { headers });
            if (!companyRes.ok) throw new Error("Failed to fetch entity details from SEC.");

            const companyData = await companyRes.json() as any;

            // Extract relevant KYB data
            const kybData = {
                verified: true,
                legal_name: companyData.name,
                cik: companyData.cik,
                entity_type: companyData.entityType,
                sic_code: companyData.sic,
                sic_description: companyData.sicDescription,
                state_of_incorporation: companyData.stateOfIncorporation,
                fiscal_year_end: companyData.fiscalYearEnd,
                business_address: {
                    street: companyData.addresses?.business?.street1,
                    city: companyData.addresses?.business?.city,
                    state: companyData.addresses?.business?.stateOrCountry,
                    zip: companyData.addresses?.business?.zipCode,
                },
                recent_filings_count: companyData.filings?.recent?.accessionNumber?.length || 0,
            };

            return {
                success: true,
                data: kybData,
                summary: `Successfully verified ${exactName} (CIK: ${kybData.cik}) via SEC EDGAR.`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `SEC API error: ${(err as Error).message}`,
            };
        }
    },
};
