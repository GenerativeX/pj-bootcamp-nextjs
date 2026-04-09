import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  WebController,
  type PageContentResponse as PageContentResponseBody,
  type WebSearchResponse as WebSearchResponseBody,
} from "@/controllers/web-controller";

const webSearchRoute = new OpenAPIHono();
const controller = new WebController();

const SearchQuerySchema = z.object({
  q: z.string().min(1).openapi({
    example: "最新のAIニュース",
    description: "検索キーワード",
  }),
  num: z.coerce.number().int().min(1).max(20).optional().openapi({
    example: 5,
    description: "取得する検索結果数（最大20）",
  }),
});

const SearchResultSchema = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string(),
  position: z.number().int().min(1),
});

const SearchResponseSchema = z.object({
  organic_results: z.array(SearchResultSchema),
  search_metadata: z.object({
    query: z.string(),
    total_results: z.number().int().min(0),
  }),
});

const PageContentRequestSchema = z.object({
  url: z.string().url().openapi({
    example: "https://example.com",
    description: "取得するページのURL",
  }),
});

const PageContentResponseSchema = z.object({
  content: z.string(),
  contentType: z.string().nullish(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  suggestion: z.string().optional(),
});

type ErrorResponseBody = z.infer<typeof ErrorResponseSchema>;

webSearchRoute.openapi(
  createRoute({
    method: "get",
    path: "/search",
    tags: ["web-search"],
    request: {
      query: SearchQuerySchema,
    },
    responses: {
      200: {
        description: "検索結果の取得に成功しました。",
        content: {
          "application/json": {
            schema: SearchResponseSchema,
          },
        },
      },
      400: {
        description: "リクエストパラメータが不正です。",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "検索処理中にエラーが発生しました。",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    const { q, num } = c.req.valid("query");

    try {
      const result = await controller.search(q, num);
      return c.json<WebSearchResponseBody, 200>(result, 200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "検索処理に失敗しました。";
      return c.json<ErrorResponseBody, 500>({ error: message }, 500);
    }
  },
);

webSearchRoute.openapi(
  createRoute({
    method: "post",
    path: "/page-content",
    tags: ["web-search"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: PageContentRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "ページ内容の取得に成功しました。",
        content: {
          "application/json": {
            schema: PageContentResponseSchema,
          },
        },
      },
      400: {
        description: "リクエストが不正、またはページを取得できませんでした。",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "サーバーで予期しないエラーが発生しました。",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      const { url } = c.req.valid("json") as z.infer<
        typeof PageContentRequestSchema
      >;
      const result = await controller.fetchPageContent(url);
      return c.json<PageContentResponseBody, 200>(result, 200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "ページ内容の取得に失敗しました。";
      const isUrlError =
        error instanceof Error &&
        (/無効なURL/.test(error.message) ||
          /HTTP\/HTTPS以外/.test(error.message));
      const suggestion =
        error instanceof Error && /HTTP\/HTTPS以外/.test(error.message)
          ? "HTTPまたはHTTPSのURLを指定してください。"
          : undefined;
      if (!isUrlError && error instanceof Error) {
        const statusMatch = error.message.match(/\b(\d{3})\b/);
        if (statusMatch) {
          const code = Number.parseInt(statusMatch[1], 10);
          if (Number.isFinite(code) && code >= 400 && code < 500) {
            return c.json<ErrorResponseBody, 400>(
              { error: message, suggestion },
              400,
            );
          }
        }
      }
      if (isUrlError) {
        return c.json<ErrorResponseBody, 400>(
          { error: message, suggestion },
          400,
        );
      }
      return c.json<ErrorResponseBody, 500>(
        { error: message, suggestion },
        500,
      );
    }
  },
);

export default webSearchRoute;
