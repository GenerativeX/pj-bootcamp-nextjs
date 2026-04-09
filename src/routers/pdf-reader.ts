import { createRoute, z } from "@hono/zod-openapi";
import { OpenAPIHono } from "@hono/zod-openapi";
import { readPdf } from "@/controllers/pdf-reader-controller";

const app = new OpenAPIHono();

// レスポンススキーマ
const PdfPageTextSchema = z
  .object({
    index: z.number().int().openapi({ example: 1 }),
    text: z.string().openapi({ example: "Page content here..." }),
  })
  .openapi("PdfPageText");

const PdfReadResultSchema = z
  .object({
    pages: z.array(PdfPageTextSchema),
    totalPages: z.number().int().openapi({ example: 5 }),
  })
  .openapi("PdfReadResult");

const ErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi("Error");

// POSTルート: PDFファイルをアップロードしてテキスト抽出
const readPdfRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["pdf-reader"],
  summary: "PDFファイルからテキストを抽出",
  description:
    "アップロードされたPDFファイルから各ページのテキストを抽出します",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .instanceof(File)
              .openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "PDF読み取り成功",
      content: {
        "application/json": {
          schema: PdfReadResultSchema,
        },
      },
    },
    400: {
      description: "不正なリクエスト",
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

app.openapi(readPdfRoute, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "PDFファイルが指定されていません" }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const result = await readPdf(buffer);

  return c.json(result, 200);
});

export default app;
