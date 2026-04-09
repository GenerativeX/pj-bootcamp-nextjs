"use client";

import { atom, useAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// URLパス → セッションID のエフェメラル（アプリ稼働中のみ）マッピング
const urlSessionMapAtom = atom<Record<string, string>>({});

const SESSION_QUERY_KEY = "session";

export function useEphemeralUrlSession() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [map, setMap] = useAtom(urlSessionMapAtom);
  const querySessionId =
    searchParams?.get(SESSION_QUERY_KEY)?.trim() ?? undefined;

  const sessionId = useMemo(() => {
    if (querySessionId && querySessionId.length > 0) {
      return querySessionId;
    }
    const existing = map[pathname];
    return existing ?? crypto.randomUUID();
  }, [map, pathname, querySessionId]);

  useEffect(() => {
    // 初回のみ現在のURLに対するセッションIDを確定
    setMap((prev) =>
      prev[pathname] === sessionId ? prev : { ...prev, [pathname]: sessionId },
    );
  }, [pathname, sessionId, setMap]);

  useEffect(() => {
    if (!router || !sessionId) {
      return;
    }
    if (querySessionId === sessionId) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set(SESSION_QUERY_KEY, sessionId);
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }, [pathname, querySessionId, router, searchParams, sessionId]);

  const setSessionId = useCallback(
    (nextSessionId: string) => {
      const normalized = nextSessionId.trim();
      if (!normalized) {
        return;
      }

      setMap((prev) =>
        prev[pathname] === normalized
          ? prev
          : {
              ...prev,
              [pathname]: normalized,
            },
      );

      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set(SESSION_QUERY_KEY, normalized);
      const query = params.toString();
      router.replace(`${pathname}${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [pathname, router, searchParams, setMap],
  );

  const reset = () => {
    setSessionId(crypto.randomUUID());
  };

  return { sessionId, reset, setSessionId, pathname } as const;
}
