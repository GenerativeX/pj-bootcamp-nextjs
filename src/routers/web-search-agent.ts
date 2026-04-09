import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { runWebSearchAgent } from "@/controllers/web-search-agent-controller";

const webSearchAgentRoute = new OpenAPIHono();

const MessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]).openapi({
      description: "メッセージの役割",
    }),
    content: z.string().openapi({
      description: "メッセージの内容",
    }),
  })
  .openapi("AgentMessage");

const AgentRequestSchema = z
  .object({
    messages: z.array(MessageSchema).openapi({
      description: "チャットメッセージの配列",
    }),
    model: z.string().optional().default("claude-sonnet-4-6").openapi({
      description: "使用するモデル名",
      example: "claude-sonnet-4-6",
    }),
  })
  .openapi("AgentRequest");

const AgentResponseSchema = z
  .object({
    response: z.string().openapi({
      description: "エージェントからの応答テキスト",
    }),
    model: z.string().openapi({
      description: "使用したモデル名",
    }),
  })
  .openapi("AgentResponse");

const ErrorSchema = z
  .object({
    error: z.string(),
    details: z.string().optional(),
  })
  .openapi("AgentError");

const postRunRoute = createRoute({
  method: "post",
  path: "/run",
  tags: ["web-search-agent"],
  summary: "Web検索エージェント実行",
  description:
    "OpenAI Agents SDKとSerpAPIを使用したWeb検索エージェントを実行します",
  request: {
    body: {
      content: {
        "application/json": {
          schema: AgentRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "成功",
      content: {
        "application/json": {
          schema: AgentResponseSchema,
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

webSearchAgentRoute.openapi(postRunRoute, async (c) => {
  try {
    const body = c.req.valid("json");
    const result = await runWebSearchAgent(body);
    return c.json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[WebSearchAgent] Error:", message);
    return c.json(
      {
        error: "Agent execution failed",
        details: message,
      },
      500,
    );
  }
});

export default webSearchAgentRoute;
