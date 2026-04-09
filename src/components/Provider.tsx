"use client";

import { useServerInsertedHTML } from "next/navigation";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useState } from "react";
import { ChakraProvider } from "@chakra-ui/react";
import systemTheme from "@/lib/systemTheme";
import { Toaster } from "@/components/ui/toaster";

export function Provider({ children }: { children: React.ReactNode }) {
  const [cache] = useState(() => {
    // to avoid flash of
    const cache = createCache({ key: "css" });
    cache.compat = true;
    return cache;
  });

  useServerInsertedHTML(() => {
    return (
      <style
        data-emotion={`${cache.key} ${Object.keys(cache.inserted).join(" ")}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Emotion requires this for SSR
        dangerouslySetInnerHTML={{
          __html: Object.values(cache.inserted).join(" "),
        }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ChakraProvider value={systemTheme}>
        {children}
        <Toaster />
      </ChakraProvider>
    </CacheProvider>
  );
}
