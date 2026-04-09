import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { WebController } from "@/controllers/web-controller";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  enable_web_search?: boolean;
  web_search_max_results?: number;
}

export interface ChatResponse {
  response: string;
  model: string;
  user?: string;
}

export class LlmChatController {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private bedrock: BedrockRuntimeClient | null = null;
  private webController = new WebController();
  /**
   * ローカル開発用のモック応答を使うかどうか
   * - 明示的に LLM_USE_MOCK=true の場合
   * - 開発環境かつ OpenAI / Bedrock どちらの認証情報も無い場合
   */
  private useMock: boolean;
  private hasOpenAI: boolean;
  private hasAnthropic: boolean;
  private hasBedrock: boolean;

  constructor() {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const awsRegion = process.env.AWS_REGION || "ap-northeast-1";
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    this.hasOpenAI = !!openaiApiKey;
    this.hasAnthropic = !!anthropicApiKey;
    this.hasBedrock = !!(awsAccessKeyId && awsSecretAccessKey);

    const isDev = process.env.NODE_ENV !== "production";
    this.useMock =
      process.env.LLM_USE_MOCK === "true" ||
      (isDev && !this.hasOpenAI && !this.hasBedrock && !this.hasAnthropic);

    if (this.hasOpenAI && openaiApiKey) {
      this.openai = new OpenAI({
        apiKey: openaiApiKey,
      });
    }

    if (this.hasAnthropic && anthropicApiKey) {
      this.anthropic = new Anthropic({
        apiKey: anthropicApiKey,
      });
    }

    if (this.hasBedrock && awsAccessKeyId && awsSecretAccessKey) {
      this.bedrock = new BedrockRuntimeClient({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
        },
      });
    }
  }

  async chat(request: ChatRequest, userEmail?: string): Promise<ChatResponse> {
    const {
      messages,
      model = "gpt-5.4-2026-03-05",
      temperature = 0.7,
      max_tokens = 2000,
      enable_web_search = false,
      web_search_max_results = 5,
    } = request;

    if (!messages || messages.length === 0) {
      throw new Error("Messages are required");
    }

    const isClaude = model.startsWith("claude-");
    const isDev = process.env.NODE_ENV !== "production";
    const preferAnthropic = isDev && this.hasAnthropic;

    console.log(`[LLM Chat] User: ${userEmail}`);
    console.log(
      `[LLM Chat] Provider: ${
        isClaude
          ? preferAnthropic
            ? "Claude (Anthropic)"
            : "Claude (Bedrock)"
          : "OpenAI"
      }`,
    );
    console.log(`[LLM Chat] Model: ${model}`);
    console.log(`[LLM Chat] Messages count: ${messages.length}`);
    console.log(`[LLM Chat] Web search enabled: ${enable_web_search}`);

    const finalMessages = await this.withWebSearchContext(
      messages,
      enable_web_search,
      web_search_max_results,
    );

    let responseText = "";

    const shouldUseMock =
      this.useMock ||
      (isClaude && !this.hasBedrock && !preferAnthropic) ||
      (!isClaude && !this.hasOpenAI);

    if (shouldUseMock) {
      console.log("[LLM Chat] Using mock LLM response (local mode)");
      responseText = this.chatWithMock(finalMessages, model);
    } else if (isClaude) {
      responseText = preferAnthropic
        ? await this.chatWithClaudeAnthropic(
            finalMessages,
            model,
            temperature,
            max_tokens,
          )
        : await this.chatWithClaudeBedrock(
            finalMessages,
            model,
            temperature,
            max_tokens,
          );
    } else {
      responseText = await this.chatWithOpenAI(
        finalMessages,
        model,
        temperature,
        max_tokens,
      );
    }

    console.log(
      `[LLM Chat] Response length: ${responseText.length} characters`,
    );

    return {
      response: responseText,
      model: model,
      user: userEmail,
    };
  }

  /**
   * ローカル開発用のモック応答
   * 外部APIの認証情報が無い場合でも /chat を試せるようにする
   */
  private chatWithMock(messages: ChatMessage[], model: string): string {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    const userContent =
      lastUserMessage?.content ?? "（ユーザーメッセージが空です）";

    return [
      `【ローカル開発用モック応答】`,
      `model: ${model}`,
      "",
      "これは外部のLLM APIを呼び出さずに生成されたダミー応答です。",
      "",
      "直近のあなたのメッセージ:",
      userContent,
    ].join("\n");
  }

  private async withWebSearchContext(
    messages: ChatMessage[],
    enableWebSearch: boolean,
    webSearchMaxResults: number,
  ): Promise<ChatMessage[]> {
    if (!enableWebSearch) {
      return messages;
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user" && m.content.trim().length > 0);

    if (!lastUserMessage) {
      return messages;
    }

    try {
      const result = await this.webController.search(
        lastUserMessage.content.trim(),
        webSearchMaxResults,
      );

      if (result.organic_results.length === 0) {
        return messages;
      }

      const references = result.organic_results
        .slice(0, webSearchMaxResults)
        .map(
          (item, index) =>
            `${index + 1}. ${item.title}\nURL: ${item.link}\n概要: ${item.snippet}`,
        )
        .join("\n\n");

      const webSearchSystemMessage: ChatMessage = {
        role: "system",
        content: [
          "以下は最新のWeb検索結果です。金融の質問に回答する際は、必要に応じてこの情報を優先して参照してください。",
          "検索結果にない情報を断定しないでください。",
          `検索クエリ: ${result.search_metadata.query}`,
          references,
        ].join("\n\n"),
      };

      return [...messages, webSearchSystemMessage];
    } catch (error) {
      console.warn("[LLM Chat] Web search failed:", error);
      return messages;
    }
  }

  private mapClaudeModelToBedrockModelId(model: string): string {
    const modelIdMap: Record<string, string> = {
      "claude-opus-4-6": "anthropic.claude-opus-4-6-v1:0",
      "claude-sonnet-4-6": "anthropic.claude-sonnet-4-6-v1:0",
      "claude-haiku-4-5": "anthropic.claude-haiku-4-5-20251001-v1:0",
      "claude-haiku-4-5-20251001": "anthropic.claude-haiku-4-5-20251001-v1:0",
    };
    return modelIdMap[model] || model;
  }

  private bedrockModelIdToAnthropicModelName(modelId: string): string {
    if (!modelId.startsWith("anthropic.")) return modelId;
    const withoutPrefix = modelId.slice("anthropic.".length);
    return withoutPrefix.replace(/-v\d+:\d+$/, "");
  }

  private async chatWithClaudeBedrock(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    max_tokens: number,
  ): Promise<string> {
    console.log("[LLM Chat] Using AWS Bedrock API");

    if (!this.bedrock) {
      throw new Error("AWS Bedrock client is not configured");
    }

    const bedrockModelId = this.mapClaudeModelToBedrockModelId(model);

    const systemMessage = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const chatMessages = messages.filter((m) => m.role !== "system");

    const requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: max_tokens,
      temperature: temperature,
      messages: chatMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: [{ type: "text", text: m.content }],
      })),
      ...(systemMessage ? { system: systemMessage } : {}),
    };

    const command = new InvokeModelCommand({
      modelId: bedrockModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(requestBody),
    });

    const response = await this.bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return responseBody.content[0]?.text || "";
  }

  private async chatWithClaudeAnthropic(
    messages: ChatMessage[],
    model: string,
    temperature: number,
    max_tokens: number,
  ): Promise<string> {
    console.log("[LLM Chat] Using Anthropic API");

    if (!this.anthropic) {
      throw new Error("Anthropic client is not configured");
    }

    const bedrockModelId = this.mapClaudeModelToBedrockModelId(model);
    const anthropicModel = model.startsWith("anthropic.")
      ? this.bedrockModelIdToAnthropicModelName(model)
      : this.bedrockModelIdToAnthropicModelName(bedrockModelId);

    const systemMessage = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const chatMessages = messages.filter((m) => m.role !== "system");

    const response = await this.anthropic.messages.create({
      model: anthropicModel,
      max_tokens,
      temperature,
      messages: chatMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: [{ type: "text", text: m.content }],
      })),
      ...(systemMessage ? { system: systemMessage } : {}),
    });

    const first = response.content?.[0];
    if (!first) return "";
    // SDKの型上は union なので安全側に倒す
    return "text" in first ? (first.text ?? "") : "";
  }

  private async chatWithOpenAI(
    messages: ChatMessage[],
    model: string,
    _temperature: number,
    max_tokens: number,
  ): Promise<string> {
    console.log("[LLM Chat] Using OpenAI API");
    console.log(`[LLM Chat] Model: ${model}`);

    if (!this.openai) {
      throw new Error("OpenAI client is not configured");
    }

    const requestOptions = {
      model,
      input: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_output_tokens: max_tokens,
      reasoning: { effort: "medium" as const },
    };

    console.log(
      "[LLM Chat] Request options:",
      JSON.stringify(requestOptions, null, 2),
    );
    const response = await this.openai.responses.create(requestOptions);
    if (response.output_text && response.output_text.trim().length > 0) {
      return response.output_text;
    }
    // output_text が空のケースに備えて、生の output からテキストを抽出する
    const outputText = this.extractResponseText(response);
    return outputText;
  }

  private extractResponseText(response: any): string {
    const output = Array.isArray(response?.output) ? response.output : [];
    const texts: string[] = [];
    for (const item of output) {
      if (item?.type !== "message") continue;
      const contents = Array.isArray(item?.content) ? item.content : [];
      for (const content of contents) {
        if (
          content?.type === "output_text" &&
          typeof content.text === "string"
        ) {
          texts.push(content.text);
        }
      }
    }
    return texts.join("\n").trim();
  }
}
