"use client";

import { Box, Button, Input, Spinner, Text, VStack } from "@chakra-ui/react";
import { useCallback, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT =
  "あなたはみずほ銀行のAIアシスタントです。日本語で簡潔かつ丁寧に回答してください。";

export default function SidebarAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "AIチャットです。ご質問を入力してください。",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const visibleMessages = useMemo(() => messages.slice(-6), [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);

    try {
      const apiMessages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ];

      const { data } = await apiClient.post("/api/llm/chat", {
        messages: apiMessages,
        model: "claude-sonnet-4-6",
        temperature: 0.7,
        max_tokens: 700,
      });
      const assistantText =
        typeof data?.response === "string"
          ? data.response
          : "回答の取得に失敗しました。";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantText,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "エラーが発生しました。時間をおいて再度お試しください。",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return (
    <Box px="4" pb="4">
      <Box borderWidth="1px" borderColor="gray.200" borderRadius="md" p="3">
        <VStack align="stretch" gap="2">
          <Box
            bg="gray.50"
            borderRadius="md"
            p="2"
            maxH="180px"
            overflowY="auto"
            borderWidth="1px"
            borderColor="gray.100"
          >
            <VStack align="stretch" gap="2">
              {visibleMessages.map((message) => (
                <Box
                  key={message.id}
                  bg={message.role === "user" ? "blue.50" : "white"}
                  borderRadius="sm"
                  p="2"
                >
                  <Text fontSize="xs" color="gray.500" mb="1">
                    {message.role === "user" ? "あなた" : "AI"}
                  </Text>
                  <Text fontSize="sm" whiteSpace="pre-wrap">
                    {message.content}
                  </Text>
                </Box>
              ))}
              {isLoading && (
                <Box display="flex" alignItems="center" gap="2" p="2">
                  <Spinner size="xs" />
                  <Text fontSize="sm" color="gray.600">
                    生成中...
                  </Text>
                </Box>
              )}
            </VStack>
          </Box>

          <Input
            size="sm"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="AIに質問..."
            disabled={isLoading}
          />

          <Button
            size="sm"
            colorPalette="blue"
            onClick={() => void sendMessage()}
            loading={isLoading}
          >
            送信
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
