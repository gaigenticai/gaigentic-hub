/**
 * Browse URL Tool — Web page content extraction.
 *
 * Gives agents the ability to visit any webpage and extract its content.
 * Primary mode: HTTP fetch with HTML-to-text extraction (works everywhere).
 * Future: Cloudflare Browser Rendering for JS-heavy sites when binding is enabled.
 *
 * To enable full browser rendering, uncomment [browser] in wrangler.toml
 * and install @cloudflare/puppeteer.
 */

import type { ToolDefinition } from "./types";

export const browseUrlTool: ToolDefinition = {
  name: "browse_url",
  description:
    "Visit a webpage and extract its text content and metadata. Useful for reading articles, checking company websites, verifying information, extracting data from web pages, or gathering evidence for compliance checks.",
  category: "knowledge",
  stepType: "data_fetch",
  parameters: {
    url: {
      type: "string",
      description:
        "The full URL to visit (must start with http:// or https://).",
      required: true,
    },
    extract: {
      type: "string",
      description:
        "What to extract: 'text' for main page text content (default), 'metadata' for title/description, 'full' for both.",
      required: false,
    },
  },
  async execute(params) {
    const url = (params.url as string)?.trim();
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return {
        success: false,
        data: null,
        summary: "A valid URL starting with http:// or https:// is required.",
      };
    }

    const extractMode = (params.extract as string) || "text";

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "GaiGentic-Agent/1.0 (https://hub.gaigentic.ai)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        redirect: "follow",
      });

      if (!res.ok) {
        return {
          success: false,
          data: { url, status: res.status },
          summary: `Failed to fetch ${url} — HTTP ${res.status}.`,
        };
      }

      const contentType = res.headers.get("content-type") || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain")
      ) {
        return {
          success: false,
          data: { url, content_type: contentType },
          summary: `URL returned non-HTML content (${contentType}). Cannot extract text.`,
        };
      }

      const html = await res.text();
      const result: Record<string, unknown> = { url };

      // Extract title
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      const title = titleMatch
        ? titleMatch[1]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim()
        : url;
      result.title = title;

      if (extractMode === "text" || extractMode === "full") {
        // HTML-to-text extraction
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[\s\S]*?<\/nav>/gi, "")
          .replace(/<footer[\s\S]*?<\/footer>/gi, "")
          .replace(/<header[\s\S]*?<\/header>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000);
        result.text = text;
        result.text_length = text.length;
      }

      if (extractMode === "metadata" || extractMode === "full") {
        const getMetaContent = (name: string) => {
          const re = new RegExp(
            `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
            "i",
          );
          const altRe = new RegExp(
            `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
            "i",
          );
          return re.exec(html)?.[1] || altRe.exec(html)?.[1] || null;
        };

        result.metadata = {
          title,
          description:
            getMetaContent("description") || getMetaContent("og:description"),
          author: getMetaContent("author"),
          keywords: getMetaContent("keywords"),
          og_image: getMetaContent("og:image"),
        };
      }

      return {
        success: true,
        data: result,
        summary: `Browsed '${title}' — extracted ${extractMode} content (${(result.text_length as number) || 0} chars).`,
      };
    } catch (err) {
      return {
        success: false,
        data: { url, error: (err as Error).message },
        summary: `Failed to browse ${url}: ${(err as Error).message}`,
      };
    }
  },
};
