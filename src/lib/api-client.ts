/**
 * API クライアント - フロントエンド用共通ヘルパー (axios)
 */
import axios from "axios";

/** axios共通インスタンス */
export const apiClient = axios.create({
  headers: { "Content-Type": "application/json" },
});
