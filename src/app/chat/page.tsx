"use client";

import { useState, useCallback } from "react";
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
  role: "user" | "assistant" | "system";
  content: string;
  id: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: "You are a helpful assistant.",
      id: crypto.randomUUID(),
    },
  ]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-6");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      id: crypto.randomUUID(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const { data } = await apiClient.post("/api/llm/chat", {
        messages: newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        model,
        temperature: 0.7,
        max_tokens: 2000,
      });

      if (data?.response) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: data.response,
            id: crypto.randomUUID(),
          },
        ]);
      }
    } catch (error: unknown) {
      console.error("Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "エラーが発生しました";
      alert(`エラーが発生しました: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, model]);

  return (
    <Container maxW="container.lg" py={8}>
      <VStack gap={6} align="stretch">
        <Heading>LLM Chat</Heading>

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
            <optgroup label="Claude - 利用可能モデル">
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
            </optgroup>
            <optgroup label="OpenAI - GPT-5.4シリーズ">
              <option value="gpt-5.4-2026-03-05">GPT-5.4</option>
              <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
            </optgroup>
          </select>
        </Box>

        <Box
          borderWidth="1px"
          borderRadius="lg"
          p={4}
          h="400px"
          overflowY="auto"
          bg="gray.50"
        >
          <VStack gap={4} align="stretch">
            {messages
              .filter((m) => m.role !== "system")
              .map((message) => (
                <Box
                  key={message.id}
                  p={3}
                  borderRadius="md"
                  bg={message.role === "user" ? "blue.100" : "white"}
                  alignSelf={
                    message.role === "user" ? "flex-end" : "flex-start"
                  }
                  maxW="80%"
                >
                  <Text fontWeight="bold" mb={1} fontSize="sm">
                    {message.role === "user" ? "あなた" : "AI"}
                  </Text>
                  <Text whiteSpace="pre-wrap">{message.content}</Text>
                </Box>
              ))}
            {isLoading && (
              <Box p={3} borderRadius="md" bg="white" maxW="80%">
                <HStack>
                  <Spinner size="sm" />
                  <Text>考え中...</Text>
                </HStack>
              </Box>
            )}
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
            placeholder="メッセージを入力..."
            disabled={isLoading}
          />
          <Button onClick={sendMessage} loading={isLoading} colorPalette="blue">
            送信
          </Button>
        </HStack>

        <Box p={4} bg="gray.100" borderRadius="md">
          <Text fontSize="sm" color="gray.600">
            <strong>使い方:</strong>
            <br />
            1. モデルを選択（OpenAIまたはClaude）
            <br />
            2. メッセージを入力して送信
            <br />
            3. APIは自動的にモデル名から適切なAPIを選択します
          </Text>
        </Box>
      </VStack>
    </Container>
  );
}
