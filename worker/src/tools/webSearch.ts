/**
 * Web Search Tool — Multi-strategy search that works from Cloudflare Workers.
 *
 * Strategy priority:
 * 1. DuckDuckGo HTML Lite — real search results, works from CF Workers
 * 2. DuckDuckGo Instant Answer API — for quick factual answers
 * 3. Wikipedia API — reliable for entities and concepts
 * 4. Yahoo Finance — for financial/ticker queries
 * 5. Auto-simplify and retry
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
        "The search query — use plain natural language, no special operators. Be specific (e.g. 'Finexus Inc startup funding' not 'site:finexus.io').",
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

    // Strip search operators that don't work with our backends
    query = query
      .replace(/\bsite:\S+/gi, "")
      .replace(/\bOR\b/g, " ")
      .replace(/\bAND\b/g, " ")
      .replace(/\binurl:\S+/gi, "")
      .replace(/\bintitle:\S+/gi, "")
      .replace(/[""]/g, '"')
      .replace(/\s{2,}/g, " ")
      .trim();

    const count = Math.min(Math.max(Number(params.count) || 5, 1), 10);

    // Strategy 1: DDG HTML Lite — real search results
    let ddgHtmlResults: SearchResult[] = [];
    try {
      ddgHtmlResults = await searchDDGHtml(query, count);
    } catch {
      // Fall through to other strategies
    }

    if (ddgHtmlResults.length >= count) {
      return {
        success: true,
        data: {
          query,
          count: ddgHtmlResults.length,
          results: ddgHtmlResults.slice(0, count),
          source: "DuckDuckGo",
        },
        summary: `Found ${ddgHtmlResults.length} web results for '${query}'.`,
      };
    }

    // Strategy 2+3+4: Run remaining strategies in parallel
    const [ddgInstantResults, wikiResults, financeResults] = await Promise.all([
      searchDDGInstant(query),
      searchWikipedia(query, count),
      isFinancialQuery(query) ? searchYahooFinance(query) : Promise.resolve([]),
    ]);

    // Merge all results (DDG HTML first as highest quality)
    const allResults = deduplicateResults([
      ...ddgHtmlResults,
      ...ddgInstantResults,
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

    // Auto-simplify and retry with DDG HTML
    const simplified = simplifyQuery(query);
    if (simplified !== query && simplified.length > 2) {
      try {
        const retryResults = await searchDDGHtml(simplified, count);
        if (retryResults.length > 0) {
          return {
            success: true,
            data: {
              query: simplified,
              original_query: query,
              count: retryResults.length,
              results: retryResults.slice(0, count),
              source: "DuckDuckGo (simplified query)",
            },
            summary: `No results for '${query}', but found ${retryResults.length} results for '${simplified}'.`,
          };
        }
      } catch {
        // Fall through
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
 * Search via DuckDuckGo HTML Lite — the real deal.
 * Returns actual search results, not just instant answers.
 * Works from CF Workers with proper headers.
 */
async function searchDDGHtml(query: string, count: number): Promise<SearchResult[]> {
  try {
    const res = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      body: `q=${encodeURIComponent(query)}`,
    });

    if (!res.ok) return [];

    const html = await res.text();
    return parseDDGLiteHtml(html, count);
  } catch {
    return [];
  }
}

/**
 * Parse DuckDuckGo Lite HTML response into structured results.
 * DDG Lite uses a table-based layout with result links and snippets.
 */
function parseDDGLiteHtml(html: string, count: number): SearchResult[] {
  const results: SearchResult[] = [];

  // DDG Lite wraps each result in a table row with class "result-link" for the URL
  // and "result-snippet" for the description
  // Pattern: <a rel="nofollow" href="URL" class="result-link">TITLE</a>
  // followed later by <td class="result-snippet">SNIPPET</td>

  // Extract all result links
  const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;
  const snippetRegex = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1].replace(/&amp;/g, "&");
    const title = stripHtml(match[2]).trim();
    if (url && title && url.startsWith("http")) {
      links.push({ url, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1]).trim());
  }

  // Combine links with snippets
  for (let i = 0; i < Math.min(links.length, count); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || "",
    });
  }

  // Fallback: try broader link extraction if the class-based approach found nothing
  if (results.length === 0) {
    const broadRegex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{5,})<\/a>/gi;
    const seen = new Set<string>();
    while ((match = broadRegex.exec(html)) !== null && results.length < count) {
      const url = match[1].replace(/&amp;/g, "&");
      const title = stripHtml(match[2]).trim();
      // Skip DDG internal links
      if (url.includes("duckduckgo.com")) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      if (url && title) {
        results.push({ title, url, snippet: "" });
      }
    }
  }

  return results;
}

/**
 * Detect if query is about finance/stocks/ETFs/markets.
 */
function isFinancialQuery(query: string): boolean {
  return /\b(etf|stock|fund|ticker|share|equity|bond|index|nasdaq|nyse|s&p|dow|ftse|nifty|sensex|morningstar|vanguard|ishares|return|yield|dividend|portfolio|market cap)\b/i.test(query);
}

/**
 * Search via DuckDuckGo Instant Answer API.
 * Works from CF Workers — limited to instant answers / related topics.
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
 * Free, no API key, works from CF Workers.
 */
async function searchYahooFinance(query: string): Promise<SearchResult[]> {
  try {
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
