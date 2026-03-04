import type { ToolDefinition } from "./types";

export const rssNewsParserTool: ToolDefinition = {
    name: "rss_news_parser",
    description:
        "Fetches recent news articles and headlines from public open RSS feeds (like Google News) based on a query. Very useful for vendor risk management to identify recent lawsuits, data breaches, or major leadership changes associated with a company.",
    category: "knowledge",
    stepType: "data_fetch",
    parameters: {
        query: {
            type: "string",
            description: "The name of the vendor or topic to search for (e.g. 'Stripe lawsuit' or 'CrowdStrike outage').",
            required: true,
        },
        max_results: {
            type: "number",
            description: "Maximum number of headlines to fetch (default: 5).",
            required: false,
        },
    },
    async execute(params) {
        const query = encodeURIComponent((params.query as string).trim());
        const limit = Math.min(Number(params.max_results) || 5, 20);

        try {
            // Fetch open RSS feed from Google News
            const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`RSS feed fetch returned ${res.status}`);
            }

            const text = await res.text();

            // Given this is running in a Cloudflare Worker, we don't have DOMParser.
            // We'll use simple Regex to extract Items from the XML since the structure is highly predictable.
            const items: any[] = [];
            const itemRegex = new RegExp("<item>([\\\\s\\\\S]*?)</item>", "g");
            let match;

            while ((match = itemRegex.exec(text)) !== null && items.length < limit) {
                const itemXml = match[1];

                const titleMatch = new RegExp("<title>([\\\\s\\\\S]*?)</title>").exec(itemXml);
                const linkMatch = new RegExp("<link>([\\\\s\\\\S]*?)</link>").exec(itemXml);
                const dateMatch = new RegExp("<pubDate>([\\\\s\\\\S]*?)</pubDate>").exec(itemXml);
                const sourceMatch = new RegExp("<source[^>]*>([\\\\s\\\\S]*?)</source>").exec(itemXml);

                items.push({
                    title: titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"') : "No Title",
                    link: linkMatch ? linkMatch[1] : "",
                    pubDate: dateMatch ? dateMatch[1] : "",
                    source: sourceMatch ? sourceMatch[1] : "Unknown",
                });
            }

            return {
                success: true,
                data: {
                    query: decodeURIComponent(query),
                    count: items.length,
                    articles: items,
                    source_feed: "Google News Open RSS",
                },
                summary: `Retrieved ${items.length} recent news articles for '${decodeURIComponent(query)}'.`,
            };

        } catch (err) {
            return {
                success: false,
                data: null,
                summary: `News parsing failed: ${(err as Error).message}`,
            };
        }
    },
};
