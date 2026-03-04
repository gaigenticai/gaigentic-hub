import type { ToolDefinition } from "./types";

export const macroeconomicIndicatorTool: ToolDefinition = {
    name: "macroeconomic_indicator",
    description:
        "Fetches macroeconomic data (e.g., inflation, unemployment, GDP growth) for a specific country using the World Bank Open Data API. Crucial for assessing localized hardship conditions when evaluating loan forbearance or restructuring requests.",
    category: "calculation",
    stepType: "data_fetch",
    parameters: {
        country_code: {
            type: "string",
            description: "The 2-letter or 3-letter ISO country code (e.g., 'US', 'GBR', 'IND').",
            required: true,
        },
        indicator_id: {
            type: "string",
            description: "The World Bank indicator code. Examples: 'FP.CPI.TOTL.ZG' (Inflation), 'SL.UEM.TOTL.ZS' (Unemployment), 'NY.GDP.MKTP.KD.ZG' (GDP Growth). Defaults to Unemployment if omitted.",
            required: false,
        },
    },
    async execute(params) {
        const country = (params.country_code as string).toUpperCase();
        const indicator = (params.indicator_id as string) || "SL.UEM.TOTL.ZS"; // default to unemployment

        try {
            // Using the free World Bank Open Data API
            // Format: http://api.worldbank.org/v2/country/[country]/indicator/[indicator]?format=json
            const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=3&mrv=3`; // fetch most recent 3 years

            const res = await fetch(url, {
                headers: {
                    "Accept": "application/json",
                },
            });

            if (!res.ok) {
                throw new Error(`World Bank API returned ${res.status}`);
            }

            const data = await res.json() as any;

            if (!Array.isArray(data) || data.length < 2 || !data[1]) {
                return {
                    success: true,
                    data: {
                        country_code: country,
                        indicator,
                        found: false,
                        historical_data: [],
                    },
                    summary: `No recent macroeconomic data found for ${country} / ${indicator}.`,
                };
            }

            // data[1] contains the actual time series
            const timeSeries = data[1].map((entry: any) => ({
                year: entry.date,
                value: entry.value,
            })).filter((e: any) => e.value !== null);

            if (timeSeries.length === 0) {
                return {
                    success: true,
                    data: {
                        country_code: country,
                        indicator,
                        indicator_name: data[1][0]?.indicator?.value || indicator,
                        found: false,
                        historical_data: [],
                    },
                    summary: `Data exists but recent values are null for ${country} / ${indicator}.`,
                };
            }

            const latest = timeSeries[0];
            const indicatorName = data[1][0]?.indicator?.value || indicator;
            const countryName = data[1][0]?.country?.value || country;

            return {
                success: true,
                data: {
                    country_code: country,
                    country_name: countryName,
                    indicator_id: indicator,
                    indicator_name: indicatorName,
                    found: true,
                    latest_value: latest.value,
                    latest_year: latest.year,
                    historical_data: timeSeries,
                },
                summary: `Fetched ${indicatorName} for ${countryName}. Latest (${latest.year}): ${latest.value.toFixed(2)}.`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `Macroeconomic lookup failed: ${(err as Error).message}`,
            };
        }
    },
};
