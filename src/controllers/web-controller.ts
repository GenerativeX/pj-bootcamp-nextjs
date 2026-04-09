import { searchAllGoogleCustomSearch } from "@/lib/google/serp";
import { readPdf } from "@/controllers/pdf-reader-controller";

const DEFAULT_MAX_RESULTS = 10;
const MAX_ALLOWED_RESULTS = 20;
const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface WebSearchResponse {
  organic_results: WebSearchResult[];
  search_metadata: {
    query: string;
    total_results: number;
  };
}

export interface PageContentResponse {
  content: string;
  contentType?: string | null;
}

export class WebController {
  async search(query: string, maxResults?: number): Promise<WebSearchResponse> {
    const cappedResults = Math.min(
      Math.max(maxResults ?? DEFAULT_MAX_RESULTS, 1),
      MAX_ALLOWED_RESULTS,
    );

    const results = await searchAllGoogleCustomSearch(query);

    const organicResults = results
      .slice(0, cappedResults)
      .map((result, idx) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
        position: idx + 1,
      }));

    return {
      organic_results: organicResults,
      search_metadata: {
        query,
        total_results: results.length,
      },
    };
  }

  async fetchPageContent(url: string): Promise<PageContentResponse> {
    this.ensureSupportedProtocol(url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,text/plain;q=0.8,*/*;q=0.7",
          "Accept-Language": "ja,en;q=0.9",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`.trim());
      }

      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/pdf")) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const pdf = await readPdf(buffer);
        const pageText = pdf.pages
          .map((page) => `[Page ${page.index}]\n${page.text}`)
          .join("\n\n")
          .trim();

        return {
          content:
            pageText.length > 0
              ? pageText
              : "このPDFからテキストを抽出できませんでした。",
          contentType,
        };
      }

      if (contentType?.includes("text/plain")) {
        const text = await response.text();
        return {
          content: text.trim(),
          contentType,
        };
      }

      if (contentType?.includes("text/html")) {
        const html = await response.text();
        const text = this.extractTextFromHtml(html);
        return {
          content:
            text.length > 0
              ? text
              : "HTML本文をテキストとして抽出できませんでした。",
          contentType,
        };
      }

      // Fallback for other text-based responses
      const text = await response.text();
      return {
        content: text.trim(),
        contentType,
      };
    } catch (_error) {
      const message =
        _error instanceof Error ? _error.message : "Unknown fetch error";
      throw new Error(`ページ取得に失敗しました: ${message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private ensureSupportedProtocol(targetUrl: string) {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch (_error) {
      throw new Error(
        `無効なURLです。HTTPまたはHTTPSのURLを指定してください: ${targetUrl}`,
      );
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("HTTP/HTTPS以外のプロトコルはサポートしていません。");
    }
  }

  private extractTextFromHtml(html: string): string {
    const withoutScripts = html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?>[\s\S]*?<\/noscript>/gi, " ");

    const withNewlines = withoutScripts
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h[1-6]|tr)>/gi, "\n");

    return withNewlines
      .replace(/<[^>]+>/g, " ")
      .replace(/\r?\n\s*\r?\n\s*/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
