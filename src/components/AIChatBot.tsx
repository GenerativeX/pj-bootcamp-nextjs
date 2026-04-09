"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "口座開設の方法を教えて",
  "ATMの手数料は？",
  "住宅ローンの相談",
  "NISAについて教えて",
];

const SYSTEM_PROMPT = `あなたはみずほ銀行のAIアシスタントです。お客様の質問に丁寧に日本語で回答してください。
口座開設、ATM手数料、住宅ローン、NISA、振込、資産運用など、銀行サービス全般についてサポートします。
回答は簡潔にまとめ、必要に応じて箇条書きを使ってください。HTMLタグは使わず、プレーンテキストで回答してください。`;

type AgentMessageContent = {
  type?: string;
  text?: string;
};

type AgentOutputItem = {
  role?: string;
  content?: string | AgentMessageContent[];
};

type WebSearchAgentRunResponse = {
  finalOutput?: unknown;
  output?: AgentOutputItem[];
};

type AgentInputMessage =
  | {
      role: "system";
      content: string;
    }
  | {
      type: "message";
      role: "user";
      content: Array<{
        type: "input_text";
        text: string;
      }>;
    }
  | {
      type: "message";
      role: "assistant";
      status: "completed";
      content: Array<{
        type: "output_text";
        text: string;
      }>;
    };

const extractAgentText = (data: WebSearchAgentRunResponse): string => {
  if (
    typeof data.finalOutput === "string" &&
    data.finalOutput.trim().length > 0
  ) {
    return data.finalOutput;
  }

  const assistantMessage = [...(data.output ?? [])]
    .reverse()
    .find((item) => item.role === "assistant");

  if (!assistantMessage) {
    return "";
  }

  if (typeof assistantMessage.content === "string") {
    return assistantMessage.content;
  }

  if (Array.isArray(assistantMessage.content)) {
    return assistantMessage.content
      .map((entry) => (typeof entry.text === "string" ? entry.text : ""))
      .filter((segment) => segment.trim().length > 0)
      .join("\n");
  }

  return "";
};

export default function AIChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "こんにちは！みずほ銀行AIアシスタントです。\n\n口座・ローン・資産運用など、何でもお気軽にどうぞ。",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showBadge, setShowBadge] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setShowSuggestions(false);
    setIsLoading(true);

    try {
      const agentMessages: AgentInputMessage[] = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...newMessages.map((m) =>
          m.role === "user"
            ? ({
                type: "message",
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: m.content,
                  },
                ],
              } satisfies AgentInputMessage)
            : ({
                type: "message",
                role: "assistant",
                status: "completed",
                content: [
                  {
                    type: "output_text",
                    text: m.content,
                  },
                ],
              } satisfies AgentInputMessage),
        ),
      ];

      const { data } = await apiClient.post<WebSearchAgentRunResponse>(
        "/api/agents/web-search-agent/run",
        { messages: agentMessages },
      );
      const assistantText = extractAgentText(data);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            assistantText ||
            "回答の取得に失敗しました。時間をおいて再度お試しください。",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "申し訳ございません。一時的にエラーが発生しました。しばらくしてから再度お試しください。",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setShowBadge(false);
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggleChat}
        type="button"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          background: "linear-gradient(135deg, #285ae1, #1a4ed1)",
          border: "none",
          borderRadius: "50%",
          color: "white",
          fontSize: 26,
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(40,90,225,0.4)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.3s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {isOpen ? "\u2715" : "\uD83D\uDCAC"}
        {showBadge && !isOpen && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 20,
              height: 20,
              background: "#cc0033",
              borderRadius: "50%",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              border: "2px solid white",
            }}
          >
            1
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 96,
            right: 24,
            width: 400,
            height: 560,
            background: "white",
            borderRadius: 16,
            boxShadow: "0 12px 48px rgba(0,0,0,0.18)",
            zIndex: 10001,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "chatSlideUp 0.3s ease-out",
            fontFamily:
              '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #0055a8, #003e7e)",
              color: "white",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "rgba(255,255,255,0.15)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                }}
              >
                🤖
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  みずほ AIアシスタント
                </div>
                <div style={{ fontSize: 10, opacity: 0.65 }}>
                  AI搭載・24時間対応
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleChat}
              style={{
                background: "none",
                border: "none",
                color: "white",
                fontSize: 18,
                cursor: "pointer",
                opacity: 0.6,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "#f9fafb",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={`msg-${msg.role}-${i}`}
                style={{
                  display: "flex",
                  gap: 8,
                  maxWidth: "85%",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    flexShrink: 0,
                    background: msg.role === "user" ? "#285ae1" : "#e2eaff",
                    color: msg.role === "user" ? "white" : "#333",
                  }}
                >
                  {msg.role === "user" ? "👤" : "🤖"}
                </div>
                <div
                  style={{
                    padding: "11px 15px",
                    borderRadius:
                      msg.role === "user"
                        ? "14px 4px 14px 14px"
                        : "4px 14px 14px 14px",
                    fontSize: 13,
                    lineHeight: 1.7,
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #285ae1, #1a4ed1)"
                        : "white",
                    color: msg.role === "user" ? "white" : "#333",
                    border: msg.role === "user" ? "none" : "1px solid #e8eaed",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  maxWidth: "85%",
                  alignSelf: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    background: "#e2eaff",
                  }}
                >
                  🤖
                </div>
                <div
                  style={{
                    padding: "11px 15px",
                    borderRadius: "4px 14px 14px 14px",
                    background: "white",
                    border: "1px solid #e8eaed",
                    display: "flex",
                    gap: 4,
                    alignItems: "center",
                  }}
                >
                  <span
                    className="typing-dot"
                    style={{ animationDelay: "0s" }}
                  />
                  <span
                    className="typing-dot"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="typing-dot"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                padding: "0 18px 12px",
                background: "#f9fafb",
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: "6px 14px",
                    border: "1px solid #c0d2ff",
                    borderRadius: 20,
                    background: "white",
                    color: "#285ae1",
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontWeight: 500,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#285ae1";
                    e.currentTarget.style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.color = "#285ae1";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            style={{
              padding: "14px 16px",
              borderTop: "1px solid #eee",
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "white",
              flexShrink: 0,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing)
                  sendMessage(input);
              }}
              placeholder="メッセージを入力..."
              style={{
                flex: 1,
                border: "1px solid #ddd",
                borderRadius: 22,
                padding: "9px 18px",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#285ae1")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd")}
            />
            <button
              type="button"
              onClick={() => sendMessage(input)}
              disabled={isLoading}
              style={{
                width: 38,
                height: 38,
                background: "linear-gradient(135deg, #285ae1, #1a4ed1)",
                border: "none",
                borderRadius: "50%",
                color: "white",
                fontSize: 15,
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .typing-dot {
          width: 7px;
          height: 7px;
          background: #b0b8c1;
          border-radius: 50%;
          display: inline-block;
          animation: typingBounce 1.4s infinite;
        }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  );
}
