/**
 * Web Search Tool — DuckDuckGo integration (zero API key, zero cost).
 *
 * Strategy:
 * 1. Try DuckDuckGo HTML lite page — parse real search results
 * 2. If blocked (CAPTCHA), fall back to DuckDuckGo Instant Answer API
 * 3. Both are completely free, no API key needed
 */

import type { ToolDefinition } from "./types";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export const webSearchTool: ToolDefinition = {
  name: "web_search",
  description:
    "Search the internet for real-time information. Useful for finding current news, company information, regulatory updates, market data, recent events, or any publicly available information. Returns titles, URLs, and snippets from top results.",
  category: "knowledge",
  stepType: "data_fetch",
  parameters: {
    query: {
      type: "string",
      description:
        "The search query — be specific for best results (e.g. 'India GST threshold 2025 freelancers' rather than just 'GST').",
      required: true,
    },
    count: {
      type: "number",
      description: "Number of results to return (default: 5, max: 10).",
      required: false,
    },
  },
  async execute(params) {
    const query = (params.query as string)?.trim();
    if (!query) {
      return {
        success: false,
        data: null,
        summary: "Search query is required.",
      };
    }

    const count = Math.min(Math.max(Number(params.count) || 5, 1), 10);

    // Strategy 1: DuckDuckGo HTML lite search
    const htmlResults = await searchDDGHtml(query, count);
    if (htmlResults.length > 0) {
      return {
        success: true,
        data: {
          query,
          count: htmlResults.length,
          results: htmlResults,
          source: "DuckDuckGo",
        },
        summary: `Found ${htmlResults.length} web results for '${query}'.`,
      };
    }

    // Strategy 2: DuckDuckGo Instant Answer API (fallback)
    const instantResults = await searchDDGInstant(query);
    if (instantResults.length > 0) {
      return {
        success: true,
        data: {
          query,
          count: instantResults.length,
          results: instantResults,
          source: "DuckDuckGo Instant Answers",
        },
        summary: `Found ${instantResults.length} results for '${query}' (instant answers).`,
      };
    }

    return {
      success: false,
      data: { query },
      summary: `No web results found for '${query}'. Try a different or more specific query.`,
    };
  },
};

/**
 * Search via DuckDuckGo HTML lite page.
 * Parses the static HTML response for search result links and snippets.
 */
async function searchDDGHtml(
  query: string,
  count: number,
): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
      {
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `q=${encodeURIComponent(query)}`,
      },
    );

    if (!res.ok) return [];

    const html = await res.text();

    // Check for CAPTCHA
    if (html.includes("robot") || html.includes("captcha") || html.includes("challenge")) {
      return [];
    }

    // Parse results from lite page
    // DDG lite has a table-based layout with result links and snippets
    const results: SearchResult[] = [];

    // Match result links: <a rel="nofollow" href="URL" class="result-link">Title</a>
    const linkRegex =
      /<a[^>]*rel="nofollow"[^>]*href="([^"]*)"[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/gi;
    // Also try without class for broader matching
    const altLinkRegex =
      /<a[^>]*rel="nofollow"[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

    // Extract snippets: <td class="result-snippet">...</td>
    const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    // Try primary pattern
    let linkMatch;
    const links: { url: string; title: string }[] = [];

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const url = decodeDDGUrl(linkMatch[1]);
      const title = stripHtml(linkMatch[2]);
      if (url && title && url.startsWith("http")) {
        links.push({ url, title });
      }
    }

    // Fallback to alt pattern if no results
    if (links.length === 0) {
      while ((linkMatch = altLinkRegex.exec(html)) !== null) {
        const url = decodeDDGUrl(linkMatch[1]);
        const title = stripHtml(linkMatch[2]);
        if (
          url &&
          title &&
          url.startsWith("http") &&
          !url.includes("duckduckgo.com")
        ) {
          links.push({ url, title });
        }
      }
    }

    // Extract snippets
    const snippets: string[] = [];
    let snippetMatch;
    while ((snippetMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(stripHtml(snippetMatch[1]).slice(0, 300));
    }

    // Combine links and snippets
    for (let i = 0; i < Math.min(links.length, count); i++) {
      results.push({
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || "",
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Search via DuckDuckGo Instant Answer API.
 * Returns instant answers, related topics — not full search results.
 * Always works, no CAPTCHA, but limited scope.
 */
async function searchDDGInstant(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      {
        headers: {
          "User-Agent": "GaiGentic-Agent/1.0 (https://hub.gaigentic.ai)",
        },
      },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      Abstract?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      Heading?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
        Topics?: Array<{ Text?: string; FirstURL?: string }>;
      }>;
      Results?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: SearchResult[] = [];

    // Add abstract if available
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract,
      });
    }

    // Add direct results
    if (data.Results) {
      for (const r of data.Results) {
        if (r.Text && r.FirstURL) {
          results.push({
            title: r.Text.split(" - ")[0] || r.Text,
            url: r.FirstURL,
            snippet: r.Text,
          });
        }
      }
    }

    // Add related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics) {
        if (results.length >= 10) break;
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
        // Handle nested topic groups
        if (topic.Topics) {
          for (const sub of topic.Topics) {
            if (results.length >= 10) break;
            if (sub.Text && sub.FirstURL) {
              results.push({
                title: sub.Text.split(" - ")[0] || sub.Text,
                url: sub.FirstURL,
                snippet: sub.Text,
              });
            }
          }
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

/** Decode DuckDuckGo redirect URLs (//duckduckgo.com/l/?uddg=...) */
function decodeDDGUrl(url: string): string {
  if (url.includes("duckduckgo.com/l/?")) {
    try {
      const parsed = new URL(
        url.startsWith("//") ? `https:${url}` : url,
      );
      const uddg = parsed.searchParams.get("uddg");
      if (uddg) return decodeURIComponent(uddg);
    } catch {
      // Fall through
    }
  }
  return url.startsWith("//") ? `https:${url}` : url;
}

/** Strip HTML tags and decode entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
