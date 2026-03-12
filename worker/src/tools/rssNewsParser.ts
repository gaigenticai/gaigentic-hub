/**
 * RSS News Parser Tool — fetches news from Google News RSS feed.
 * Free, no API key needed.
 */

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
      description:
        "The name of the vendor or topic to search for (e.g. 'Stripe lawsuit' or 'CrowdStrike outage').",
      required: true,
    },
    max_results: {
      type: "number",
      description: "Maximum number of headlines to fetch (default: 5).",
      required: false,
    },
  },
  async execute(params) {
    const query = (params.query as string).trim();
    const limit = Math.min(Number(params.max_results) || 5, 20);

    try {
      // Fetch open RSS feed from Google News
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });

      if (!res.ok) {
        throw new Error(`RSS feed fetch returned ${res.status}`);
      }

      const text = await res.text();

      // Parse XML items using regex (no DOMParser in CF Workers)
      const items: Array<{
        title: string;
        link: string;
        pubDate: string;
        source: string;
      }> = [];

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while (
        (match = itemRegex.exec(text)) !== null &&
        items.length < limit
      ) {
        const itemXml = match[1];

        const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemXml);
        const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemXml);
        const dateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemXml);
        const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/.exec(itemXml);

        items.push({
          title: titleMatch
            ? decodeEntities(titleMatch[1].trim())
            : "No Title",
          link: linkMatch ? linkMatch[1].trim() : "",
          pubDate: dateMatch ? dateMatch[1].trim() : "",
          source: sourceMatch
            ? decodeEntities(sourceMatch[1].trim())
            : "Unknown",
        });
      }

      return {
        success: true,
        data: {
          query,
          count: items.length,
          articles: items,
          source_feed: "Google News Open RSS",
        },
        summary:
          items.length > 0
            ? `Retrieved ${items.length} recent news articles for '${query}'.`
            : `No recent news found for '${query}'.`,
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

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
