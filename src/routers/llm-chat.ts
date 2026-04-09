import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { LlmChatController } from "@/controllers/llm-chat-controller";

type LlmRouteEnv = {
  Bindings: Record<string, never>;
  Variables: {
    session?: { user?: { email?: string | null } } | null;
  };
};

const llmChatRoute = new OpenAPIHono<LlmRouteEnv>();
const controller = new LlmChatController();

/**
 * OpenAPI用スキーマ定義
 */

// メッセージスキーマ
const ChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]).openapi({
      description: "メッセージの役割",
    }),
    content: z.string().openapi({
      description: "メッセージの内容",
    }),
  })
  .openapi("ChatMessage");

// リクエストスキーマ
const ChatRequestSchema = z
  .object({
    messages: z.array(ChatMessageSchema).openapi({
      description: "チャットメッセージの配列",
    }),
    model: z.string().optional().default("gpt-5.4-2026-03-05").openapi({
      description:
        "使用するモデル名（例: gpt-5.4-2026-03-05, gpt-5.3-codex, claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5）",
      example: "gpt-5.4-2026-03-05",
    }),
    temperature: z.number().min(0).max(2).optional().default(0.7).openapi({
      description: "温度パラメータ（0-2）",
      example: 0.7,
    }),
    max_tokens: z.number().int().positive().optional().default(2000).openapi({
      description: "最大トークン数",
      example: 2000,
    }),
    enable_web_search: z.boolean().optional().default(false).openapi({
      description:
        "true の場合、直近のユーザー質問でWeb検索を実行して回答に反映します",
      example: true,
    }),
    web_search_max_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .openapi({
        description: "Web検索時に参照する最大結果件数（1-10）",
        example: 5,
      }),
  })
  .openapi("ChatRequest");

// レスポンススキーマ
const ChatResponseSchema = z
  .object({
    response: z.string().openapi({
      description: "AIからの応答テキスト",
    }),
    model: z.string().openapi({
      description: "使用したモデル名",
    }),
    user: z.string().optional().openapi({
      description: "リクエストしたユーザーのメールアドレス",
    }),
  })
  .openapi("ChatResponse");

// エラーレスポンススキーマ
const ErrorSchema = z
  .object({
    error: z.string(),
    details: z.string().optional(),
  })
  .openapi("Error");

/**
 * POST /api/llm/chat - LLMチャット
 */
const postChatRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["llm"],
  summary: "LLMチャット",
  description: "OpenAI または Anthropic Claude を使用してチャットを行います",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "成功",
      content: {
        "application/json": {
          schema: ChatResponseSchema,
        },
      },
    },
    400: {
      description: "バリデーションエラー",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: "サーバーエラー",
      content: {
        "application/json": {
          schema: ErrorSchema,
        },
      },
    },
  },
});

llmChatRoute.openapi(postChatRoute, async (c) => {
  try {
    const body = c.req.valid("json");
    const session = c.get("session");
    const response = await controller.chat(
      body,
      session?.user?.email ?? undefined,
    );
    return c.json(response, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isBadRequest =
      message.toLowerCase().includes("required") ||
      message.toLowerCase().includes("invalid");
    const status = isBadRequest ? 400 : 500;
    return c.json(
      {
        error: isBadRequest ? "Bad Request" : "Internal server error",
        details: message,
      },
      status,
    );
  }
});

export { llmChatRoute };
