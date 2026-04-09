import axios, { type AxiosRequestConfig } from "axios";

export function getBaseUrl() {
  // ブラウザ側（フロントエンド）
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }

  // Node.js (Next.js サーバー側)
  return `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

export function apiFetch<T = unknown>(
  path: string,
  options?: AxiosRequestConfig,
) {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  return axios<T>({ url, ...options });
}
