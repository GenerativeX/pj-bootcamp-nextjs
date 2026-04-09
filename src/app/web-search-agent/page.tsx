"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  VStack,
  HStack,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { apiClient } from "@/lib/api-client";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

export default function WebSearchAgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      id: crypto.randomUUID(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMessage];
      const { data } = await apiClient.post("/api/web-search-agent/run", {
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        model,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response ?? "回答を生成できませんでした。",
          id: crypto.randomUUID(),
        },
      ]);
    } catch (error: unknown) {
      console.error("Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "エラーが発生しました";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `エラー: ${errorMessage}`,
          id: crypto.randomUUID(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, model]);

  return (
    <Container maxW="container.lg" py={8}>
      <VStack gap={6} align="stretch">
        <Box>
          <Heading size="lg">Web Search Agent</Heading>
          <Text color="gray.600" mt={1}>
            OpenAI Agents SDK + SerpAPI を使ったWeb検索エージェント
          </Text>
        </Box>

        <Box>
          <Text mb={2} fontWeight="bold">
            モデルを選択:
          </Text>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              maxWidth: "400px",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          >
            <optgroup label="Claude">
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            </optgroup>
            <optgroup label="OpenAI">
              <option value="gpt-5.4-2026-03-05">GPT-5.4</option>
              <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
            </optgroup>
          </select>
        </Box>

        <Box
          borderWidth="1px"
          borderRadius="lg"
          p={4}
          h="500px"
          overflowY="auto"
          bg="gray.50"
        >
          <VStack gap={4} align="stretch">
            {messages.length === 0 && (
              <Box p={6} textAlign="center" color="gray.400">
                <Text fontSize="lg">
                  質問を入力してください。Web検索を使って回答します。
                </Text>
                <Text fontSize="sm" mt={2}>
                  例: 「最新のAIニュースを教えて」「東京の天気は？」
                </Text>
              </Box>
            )}
            {messages.map((message) => (
              <Box key={message.id}>
                <Box
                  p={3}
                  borderRadius="md"
                  bg={message.role === "user" ? "blue.100" : "white"}
                  maxW="85%"
                  ml={message.role === "user" ? "auto" : 0}
                  boxShadow={message.role === "assistant" ? "sm" : "none"}
                >
                  <Text fontWeight="bold" mb={1} fontSize="sm" color="gray.500">
                    {message.role === "user" ? "あなた" : "AI Agent"}
                  </Text>
                  <Text whiteSpace="pre-wrap">{message.content}</Text>
                </Box>
              </Box>
            ))}
            {isLoading && (
              <Box p={3} borderRadius="md" bg="white" maxW="85%" boxShadow="sm">
                <HStack>
                  <Spinner size="sm" />
                  <Text>Web検索中...</Text>
                </HStack>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </VStack>
        </Box>

        <HStack>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="質問を入力... (例: 最新のAIニュースを教えて)"
            disabled={isLoading}
          />
          <Button onClick={sendMessage} loading={isLoading} colorPalette="blue">
            送信
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
}
