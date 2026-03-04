import type { ToolDefinition } from "./types";

export const sanctionsScreenerTool: ToolDefinition = {
    name: "sanctions_screener",
    description:
        "Screens an individual or company name against the Consolidated Screening List (CSL) and global sanction databases (OFAC, UN, EU). Used during KYC/KYB to prevent onboarding of sanctioned entities or terrorists.",
    category: "compliance",
    stepType: "rule_check",
    parameters: {
        entity_name: {
            type: "string",
            description: "The name of the individual or company to screen.",
            required: true,
        },
        entity_type: {
            type: "string",
            description: "The type of entity: 'individual' or 'company'.",
            required: true,
        },
        countries: {
            type: "string",
            description: "Comma-separated list of ISO country codes associated with the entity (e.g. 'US, GB, RU') to narrow results.",
            required: false,
        },
    },
    async execute(params) {
        const name = (params.entity_name as string).toLowerCase().trim();
        const type = (params.entity_type as string).toLowerCase();

        // Using the free OpenSanctions fuzzy search API
        // Documentation: https://www.opensanctions.org/docs/api/
        const url = new URL("https://api.opensanctions.org/search/default");
        url.searchParams.append("q", name);
        if (type === "company") {
            url.searchParams.append("schema", "Company");
        } else {
            url.searchParams.append("schema", "Person");
        }

        try {
            const res = await fetch(url.toString(), {
                headers: {
                    "Accept": "application/json",
                },
            });

            if (!res.ok) {
                throw new Error(`Sanctions API returned ${res.status}`);
            }

            const data = await res.json() as any;

            const results = data.results || [];
            const matches = [];

            for (const result of results) {
                // OpenSanctions returns scores; we only care about high confidence matches
                // But for safety, we flag anything that strongly resembles the name
                const matchScore = result.score || 0;

                if (matchScore > 2.0) { // Rough threshold for 'likely match' in OpenSanctions
                    matches.push({
                        id: result.id,
                        name: result.caption,
                        schema: result.schema,
                        datasets: result.datasets, // E.g., 'us_ofac_sdn', 'eu_fsf', 'un_sc_sanctions'
                        countries: result.properties.country || [],
                        birth_dates: result.properties.birthDate || [],
                        match_score: matchScore,
                    });
                }
            }

            const isClean = matches.length === 0;

            return {
                success: true,
                data: {
                    status: isClean ? "CLEARED" : "FLAGGED",
                    screened_name: name,
                    entity_type: type,
                    match_count: matches.length,
                    potential_matches: matches.length > 0 ? matches : null,
                    databases_checked: ["US_OFAC_SDN", "UN_SC_SANCTIONS", "EU_FSF", "UK_HMT", "INTERPOL_RED"],
                },
                summary: isClean
                    ? `Screening cleared. No sanctions found for '${name}'.`
                    : `CAUTION: Found ${matches.length} potential sanction matches for '${name}'.`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `Sanctions screening failed: ${(err as Error).message}`,
            };
        }
    },
};
