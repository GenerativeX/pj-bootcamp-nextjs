import { run } from "@openai/agents";
import { createAgent } from "@/lib/llm/create-agent";
import { WebController } from "@/controllers/web-controller";
import { tool } from "@openai/agents";
import { z } from "zod";

const webController = new WebController();

const webSearchTool = tool({
  name: "web_search",
  description:
    "SerpAPIを使ってGoogle検索を実行し、検索結果を返します。ユーザーの質問に答えるために必要な情報を検索してください。",
  parameters: z.object({
    query: z.string().describe("検索クエリ"),
    num: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("取得する検索結果数"),
  }),
  async execute({ query, num }) {
    const result = await webController.search(query, num);
    return JSON.stringify(result, null, 2);
  },
});

const fetchPageTool = tool({
  name: "fetch_page",
  description:
    "指定したURLのページ内容を取得します。検索結果から詳細な情報を取得したい場合に使用してください。",
  parameters: z.object({
    url: z.string().url().describe("取得するページのURL"),
  }),
  async execute({ url }) {
    const result = await webController.fetchPageContent(url);
    // 長すぎるコンテンツはトリミング
    const content =
      result.content.length > 8000
        ? `${result.content.slice(0, 8000)}\n\n...(以降省略)`
        : result.content;
    return content;
  },
});

export interface WebSearchAgentRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  model?: string;
}

export interface WebSearchAgentResponse {
  response: string;
  model: string;
}

export async function runWebSearchAgent(
  request: WebSearchAgentRequest,
): Promise<WebSearchAgentResponse> {
  const modelName = request.model ?? "claude-sonnet-4-6";

  const agent = createAgent({
    name: "Web Search Agent",
    instructions: [
      "あなたはWeb検索エージェントです。ユーザーの質問に対して、必要に応じてWeb検索を行い、正確で最新の情報を提供してください。",
      "",
      "ルール:",
      "- まずユーザーの質問を理解し、検索が必要かどうか判断してください",
      "- 検索結果の情報源を明記してください",
      "- 検索結果にない情報を断定しないでください",
      "- 必要であれば複数回検索したり、ページの詳細を取得してください",
      "- 日本語で回答してください",
    ].join("\n"),
    tools: [webSearchTool, fetchPageTool],
    model: modelName,
  });

  const result = await run(agent, request.messages);

  return {
    response: result.finalOutput ?? "",
    model: modelName,
  };
}
