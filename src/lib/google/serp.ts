export interface CseResultItem {
  query: string;
  title: string;
  link: string;
  snippet: string;
}

type SerpApiOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

type SerpApiResponse = {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
};

/**
 * SerpAPI利用時に必要な環境変数を取得
 */
function getSerpApiKey(): string {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("環境変数 SERP_API_KEY を設定してください。");
  }
  return apiKey;
}

export const searchAllGoogleCustomSearch = async (
  query: string,
): Promise<CseResultItem[]> => {
  const apiKey = getSerpApiKey();
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    num: "20",
    hl: "ja",
    gl: "jp",
    api_key: apiKey,
  });

  try {
    const response = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!response.ok) {
      throw new Error(`SerpAPI request failed: ${response.status}`);
    }

    const json = (await response.json()) as SerpApiResponse;
    if (json.error) {
      throw new Error(`SerpAPI error: ${json.error}`);
    }

    const items = Array.isArray(json.organic_results)
      ? json.organic_results
      : [];
    return items.map((item) => ({
      query,
      title: item.title ?? "",
      link: item.link ?? "",
      snippet: item.snippet ?? "",
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`検索実行中にエラーが発生しました: ${message}`);
  }
};
