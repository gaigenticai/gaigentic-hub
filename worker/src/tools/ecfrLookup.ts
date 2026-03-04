import type { ToolDefinition } from "./types";

export const ecfrLookupTool: ToolDefinition = {
    name: "ecfr_lookup",
    description:
        "Searches the Electronic Code of Federal Regulations (eCFR) API for real-time US federal agency rules, regulations, and statutes. Useful for compliance agents to verify if a financial action violates current federal code.",
    category: "compliance",
    stepType: "data_fetch",
    parameters: {
        query: {
            type: "string",
            description: "The term or phrase to search within the federal regulations (e.g., 'Truth in Lending', 'wire transfer limits').",
            required: true,
        },
        title: {
            type: "number",
            description: "Optional. The specific eCFR Title number to search within (e.g., 12 for Banks and Banking, 17 for Commodity and Securities Exchanges).",
            required: false,
        },
    },
    async execute(params) {
        const query = (params.query as string).trim();
        const title = params.title as number | undefined;

        try {
            // Using the free API from National Archives (NARA)
            // Documentation: https://www.ecfr.gov/developers/documentation/api/v1#/Search/search
            const url = new URL("https://www.ecfr.gov/api/search/v1/results");
            url.searchParams.append("query", query);
            url.searchParams.append("per_page", "5"); // Limit to top 5 results to save context window
            url.searchParams.append("order", "relevance");

            if (title) {
                url.searchParams.append("title", title.toString());
            }

            const res = await fetch(url.toString(), {
                headers: {
                    "Accept": "application/json",
                },
            });

            if (!res.ok) {
                throw new Error(`eCFR API returned ${res.status}`);
            }

            const data = await res.json() as any;
            const results = data.results || [];

            if (results.length === 0) {
                return {
                    success: true,
                    data: {
                        query,
                        title_filtered: title || "ALL",
                        found: false,
                        results: [],
                    },
                    summary: `No federal regulations matched the query '${query}'.`,
                };
            }

            const formattedResults = results.map((r: any) => ({
                hierarchy: r.hierarchy_headings ? r.hierarchy_headings.join(" > ") : `Title ${r.title}`,
                type: r.type, // e.g., 'Section', 'Part'
                text_extract: r.full_text_snippet ? r.full_text_snippet.replace(/(<([^>]+)>)/gi, "").trim() : "No snippet available", // strip fast HTML returns
                volume: r.volume,
                chapter: r.chapter,
            }));

            return {
                success: true,
                data: {
                    query,
                    title_filtered: title || "ALL",
                    found: true,
                    total_matches_in_system: data.meta?.total_count || results.length,
                    top_results: formattedResults,
                },
                summary: `Found ${data.meta?.total_count || results.length} matching regulations in the eCFR database. Returning top ${formattedResults.length}.`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `eCFR lookup failed: ${(err as Error).message}`,
            };
        }
    },
};
