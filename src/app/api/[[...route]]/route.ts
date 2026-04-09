import { handle } from "hono/vercel";
import { app } from "@/routers/main";

/**
 * Next.js App RouterでHonoアプリケーションをマウント
 *
 * すべてのHTTPメソッドをHonoに委譲します
 */
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);

export const runtime = "nodejs";
