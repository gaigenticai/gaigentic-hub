/**
 * Web Search Tool — Multi-strategy search that works from Cloudflare Workers.
 *
 * DDG blocks server-side requests (bot detection), so we use multiple
 * fallback strategies that reliably work from CF Workers:
 *
 * 1. DuckDuckGo Instant Answer API (limited but works)
 * 2. Wikipedia API (reliable, great for factual queries)
 * 3. Yahoo Finance search (for financial/ticker queries)
 * 4. Auto-simplify and retry
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
    let query = (params.query as string)?.trim();
    if (!query) {
      return {
        success: false,
        data: null,
        summary: "Search query is required.",
      };
    }

    // Strip search operators that DDG Instant Answer API doesn't support
    // LLMs love generating site:, OR, AND operators — clean them out
    query = query
      .replace(/\bsite:\S+/gi, "")       // remove site:example.com
      .replace(/\bOR\b/g, "")            // remove OR operators
      .replace(/\bAND\b/g, "")           // remove AND operators
      .replace(/[""]/g, '"')             // normalize smart quotes
      .replace(/\s{2,}/g, " ")           // collapse whitespace
      .trim();

    const count = Math.min(Math.max(Number(params.count) || 5, 1), 10);

    // Run all strategies in parallel for speed
    const [ddgResults, wikiResults, financeResults] = await Promise.all([
      searchDDGInstant(query),
      searchWikipedia(query, count),
      isFinancialQuery(query) ? searchYahooFinance(query) : Promise.resolve([]),
    ]);

    // Merge and deduplicate results
    const allResults = deduplicateResults([
      ...ddgResults,
      ...financeResults,
      ...wikiResults,
    ]).slice(0, count);

    if (allResults.length > 0) {
      return {
        success: true,
        data: {
          query,
          count: allResults.length,
          results: allResults,
          source: "Web Search",
        },
        summary: `Found ${allResults.length} web results for '${query}'.`,
      };
    }

    // Auto-simplify and retry
    const simplified = simplifyQuery(query);
    if (simplified !== query) {
      const [retryDDG, retryWiki] = await Promise.all([
        searchDDGInstant(simplified),
        searchWikipedia(simplified, count),
      ]);

      const retryResults = deduplicateResults([...retryDDG, ...retryWiki]).slice(0, count);
      if (retryResults.length > 0) {
        return {
          success: true,
          data: {
            query: simplified,
            original_query: query,
            count: retryResults.length,
            results: retryResults,
            source: "Web Search (simplified query)",
          },
          summary: `No results for '${query}', but found ${retryResults.length} results for simplified query '${simplified}'.`,
        };
      }
    }

    return {
      success: false,
      data: { query },
      summary: `No web results found for '${query}'. Try a different or more specific query.`,
    };
  },
};

/**
 * Detect if query is about finance/stocks/ETFs/markets.
 */
function isFinancialQuery(query: string): boolean {
  return /\b(etf|stock|fund|ticker|share|equity|bond|index|nasdaq|nyse|s&p|dow|ftse|nifty|sensex|morningstar|vanguard|ishares|return|yield|dividend|portfolio|market cap)\b/i.test(query);
}

/**
 * Search via DuckDuckGo Instant Answer API.
 * Works from CF Workers — no bot detection. Limited to instant answers / related topics.
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
      Heading?: string;
      RelatedTopics?: Array<{
        Text?: string;
        FirstURL?: string;
        Topics?: Array<{ Text?: string; FirstURL?: string }>;
      }>;
      Results?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: SearchResult[] = [];

    if (data.Abstract && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract,
      });
    }

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

/**
 * Search via Wikipedia API.
 * Reliable from CF Workers — no rate limiting, no bot detection.
 * Great for factual, entity, and concept queries.
 */
async function searchWikipedia(
  query: string,
  count: number,
): Promise<SearchResult[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&srlimit=${count}&srprop=snippet`,
      {
        headers: {
          "User-Agent": "GaiGentic-Agent/1.0 (https://hub.gaigentic.ai)",
        },
      },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      query: {
        search: Array<{
          title: string;
          snippet: string;
          pageid: number;
        }>;
      };
    };

    return data.query.search.map((item) => ({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      snippet: stripHtml(item.snippet),
    }));
  } catch {
    return [];
  }
}

/**
 * Search via Yahoo Finance API.
 * Free, no API key, works from CF Workers. Returns stock/ETF/fund data.
 */
async function searchYahooFinance(query: string): Promise<SearchResult[]> {
  try {
    // Extract potential ticker symbols
    const words = query.toUpperCase().split(/\s+/);
    const potentialTickers = words.filter((w) => /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/.test(w));
    const searchTerm = potentialTickers.length > 0 ? potentialTickers[0] : query.split(/\s+/).slice(0, 2).join(" ");

    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchTerm)}&quotesCount=5&newsCount=3`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      quotes?: Array<{
        symbol: string;
        longname?: string;
        shortname?: string;
        exchDisp?: string;
        typeDisp?: string;
      }>;
      news?: Array<{
        title: string;
        link: string;
        publisher?: string;
      }>;
    };

    const results: SearchResult[] = [];

    // Add quote results
    if (data.quotes) {
      for (const q of data.quotes.slice(0, 3)) {
        const name = q.longname || q.shortname || q.symbol;
        results.push({
          title: `${q.symbol} — ${name}`,
          url: `https://finance.yahoo.com/quote/${q.symbol}`,
          snippet: `${q.typeDisp || "Security"} on ${q.exchDisp || "Exchange"}. View real-time price, charts, and analysis for ${name}.`,
        });
      }
    }

    // Add news results
    if (data.news) {
      for (const n of data.news.slice(0, 3)) {
        if (n.title && n.link) {
          results.push({
            title: n.title,
            url: n.link,
            snippet: n.publisher ? `Source: ${n.publisher}` : "",
          });
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

/** Deduplicate results by URL */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.url.toLowerCase().replace(/\/+$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Simplify a complex query by stripping qualifiers, dates, and specifics.
 */
function simplifyQuery(query: string): string {
  let simplified = query
    .replace(/\b20\d{2}\b/g, "")
    .replace(
      /\b(latest|current|recent|best|top|new|updated|rating|review|analysis|report|data|statistics|morningstar|performance|return|yield|price|cost|fee|expense ratio)\b/gi,
      "",
    )
    .replace(/\b\d+[-–]\s*(year|month|day|week|star|yr|mo)\b/gi, "")
    .replace(/\b\d+%/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (simplified.length < 3) {
    simplified = query.split(/\s+/).slice(0, 3).join(" ");
  }

  return simplified;
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
