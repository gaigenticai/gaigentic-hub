import type { ToolDefinition } from "./types";

export const burnerEmailDetectorTool: ToolDefinition = {
    name: "burner_email_detector",
    description:
        "Checks if an email address belongs to a disposable, temporary, or burner email provider. Useful for fraud detection to flag high-risk user accounts at signup or checkout.",
    category: "validation",
    stepType: "data_fetch",
    parameters: {
        email: {
            type: "string",
            description: "The full email address to check (e.g., 'user@10minutemail.com').",
            required: true,
        },
    },
    async execute(params) {
        const email = (params.email as string).toLowerCase().trim();
        const domainPart = email.split("@")[1];

        if (!domainPart) {
            return {
                success: false,
                data: null,
                summary: "Invalid email format.",
            };
        }

        try {
            // Fetch the latest raw list of disposable domains from github
            // This is a community-maintained list of ~80k burner domains
            const url = "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf";

            const res = await fetch(url, {
                headers: {
                    "Accept": "text/plain",
                },
            });

            if (!res.ok) {
                throw new Error("Failed to fetch disposable email database");
            }

            const text = await res.text();
            // Fast check: just see if the domain substring exists as a distinct line
            const lines = text.split('\n').filter(l => l.trim() !== '' && !l.startsWith('#'));
            const isDisposable = lines.includes(domainPart);

            return {
                success: true,
                data: {
                    email,
                    domain: domainPart,
                    is_disposable: isDisposable,
                    database_source: "github/disposable-email-domains",
                    risk_level: isDisposable ? "HIGH" : "LOW",
                    action_recommendation: isDisposable ? "BLOCK_SIGNUP" : "PROCEED",
                },
                summary: isDisposable
                    ? `WARNING: '${domainPart}' is listed as a disposable burner email domain.`
                    : `Email '${email}' is clear. Not a known burner domain.`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `Burner email lookup failed: ${(err as Error).message}`,
            };
        }
    },
};
