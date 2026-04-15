import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { ZodError } from "zod";
import { llmChatRoute } from "@/routers/llm-chat";

import pdfReaderRoute from "@/routers/pdf-reader";
import webSearchRoute from "@/routers/web-search";
import webSearchAgentRoute from "@/routers/web-search-agent";
import paymentFlowRoute from "@/routers/payment-flow";

/**
 * OpenAPIHonoアプリケーションのエントリポイント
 *
 * すべてのAPIルートをここでマウントします
 * OpenAPIドキュメントとSwagger UIを自動生成します
 */
const app = new OpenAPIHono().basePath("/api");

/**
 * グローバルエラーハンドリング
 */
app.onError((err, c) => {
  console.error("[HONO_ERROR]", err);

  // Zodバリデーションエラー
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation failed",
        details: err.flatten().fieldErrors,
      },
      400,
    );
  }

  // DBエラー
  if (err instanceof Error) {
    const errorMessage = err.message;

    // Not Found
    if (
      errorMessage.includes("Record to update not found") ||
      errorMessage.includes("Record to delete does not exist") ||
      (errorMessage.includes("No") && errorMessage.includes("found")) ||
      errorMessage.includes("does not exist")
    ) {
      return c.json({ error: "Resource not found" }, 404);
    }

    // Unique Constraint
    if (
      errorMessage.includes("Unique constraint failed") ||
      errorMessage.includes("unique constraint violation")
    ) {
      return c.json({ error: "Resource already exists" }, 409);
    }

    // Foreign Key Constraint
    if (
      errorMessage.includes("Foreign key constraint") ||
      errorMessage.includes("foreign key violation")
    ) {
      return c.json(
        { error: "Cannot delete resource: referenced by other records" },
        409,
      );
    }
  }

  // その他のエラー
  return c.json({ error: "An unexpected error occurred" }, 500);
});

// ルートをマウント
app.route("/llm/chat", llmChatRoute);

app.route("/pdf-reader", pdfReaderRoute);
app.route("/web-search", webSearchRoute);
app.route("/web-search-agent", webSearchAgentRoute);
app.route("/payment-flow", paymentFlowRoute);

/**
 * OpenAPIドキュメントエンドポイント
 * GET /api/doc - OpenAPI仕様をJSON形式で返す
 */
app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "pj-nextjs-monorepo API",
    version: "1.0.0",
    description: "型安全なCRUD API（Hono + Zod + OpenAPI）",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
  ],
  tags: [
    {
      name: "llm",
      description: "LLMチャットAPI",
    },
    {
      name: "pdf-reader",
      description: "PDF読み取りAPI",
    },
    {
      name: "web-search",
      description: "Web検索およびページ内容取得API",
    },
    {
      name: "web-search-agent",
      description: "OpenAI Agents SDK + SerpAPIによるWeb検索エージェント",
    },
    {
      name: "payment-flow",
      description: "Payment flow diagram generation & agentic revision API",
    },
  ],
});

/**
 * Swagger UIエンドポイント
 * GET /api/ui - SwaggerのUIを表示
 */
app.get("/ui", swaggerUI({ url: "/api/doc" }));

export { app };
