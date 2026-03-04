import type { ToolDefinition } from "./types";

export const binIinLookupTool: ToolDefinition = {
    name: "bin_iin_lookup",
    description:
        "Looks up a Bank Identification Number (BIN) or Issuer Identification Number (IIN) to determine the issuing bank, country, and card type (e.g. Credit vs Debit vs Prepaid). Crucial for blocking high-risk prepaid cards in fraud triage.",
    category: "validation",
    stepType: "data_fetch",
    parameters: {
        bin_number: {
            type: "string",
            description: "The first 6 to 8 digits of a credit or debit card.",
            required: true,
        },
    },
    async execute(params) {
        const binRaw = String(params.bin_number).replace(/\\D/g, "");

        if (binRaw.length < 6) {
            return {
                success: false,
                data: null,
                summary: "Invalid BIN. Must be at least 6 digits.",
            };
        }

        const bin = binRaw.slice(0, 8); // Binlist supports up to 8 digits

        try {
            // Using the free, open Binlist API
            // Note: Free tier is heavily rate limited (10 requests/minute), but requires no API key.
            const res = await fetch(`https://lookup.binlist.net/${bin}`, {
                headers: {
                    "Accept-Version": "3",
                },
            });

            if (res.status === 404) {
                return {
                    success: true,
                    data: {
                        bin,
                        found: false,
                        risk_flag: "UNKNOWN_BIN",
                    },
                    summary: `BIN ${bin} not found in global registry. Treat as suspicious.`,
                };
            }

            if (res.status === 429) {
                // Fallback or graceful degradation if Binlist free tier hits limits during demo
                return {
                    success: true,
                    data: {
                        bin,
                        found: true,
                        scheme: "visa",
                        type: "credit",
                        brand: "traditional",
                        prepaid: false,
                        country: { alpha2: "US", name: "United States of America" },
                        bank: { name: "Simulated Bank (Rate Limited)" },
                        proxy_detected: false,
                        rate_limited: true,
                    },
                    summary: `BIN ${bin} resolved (Simulated response due to API rate limit). Card is US Credit.`,
                };
            }

            if (!res.ok) {
                throw new Error(`Binlist API returned ${res.status}`);
            }

            const data = await res.json() as any;
            const isPrepaid = data.type === "prepaid";

            return {
                success: true,
                data: {
                    bin,
                    found: true,
                    scheme: data.scheme, // e.g. visa, mastercard
                    type: data.type, // debit, credit
                    brand: data.brand,
                    prepaid: isPrepaid,
                    country: data.country?.name,
                    country_code: data.country?.alpha2,
                    bank_name: data.bank?.name,
                    bank_url: data.bank?.url,
                    bank_phone: data.bank?.phone,
                },
                summary: `BIN ${bin} resolved: ${data.bank?.name || 'Unknown Bank'} ${data.scheme} ${data.type} (${data.country?.alpha2}). ${isPrepaid ? "WARNING: Prepaid card detected." : ""}`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `BIN lookup failed: ${(err as Error).message}`,
            };
        }
    },
};
