"use client";

import { useCallback, useState } from "react";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Text,
  VStack,
  Spinner,
  Card,
  Separator,
} from "@chakra-ui/react";
import { apiClient } from "@/lib/api-client";

interface PdfPage {
  index: number;
  text: string;
}

interface PdfReadResult {
  pages: PdfPage[];
  totalPages: number;
}

export default function PdfReaderPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PdfReadResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0] ?? null;
      setFile(selected);
      setResult(null);
      setError(null);
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await apiClient.post<PdfReadResult>(
        "/api/pdf-reader",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      setResult(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "PDF の読み取りに失敗しました";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  const handleReset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
  }, []);

  return (
    <Container maxW="container.lg" py={8}>
      <VStack gap={6} align="stretch">
        <Heading>PDF Reader</Heading>
        <Text color="gray.600">
          PDF ファイルをアップロードすると、ページごとのテキストを抽出して表示します。
        </Text>

        <Card.Root>
          <Card.Body>
            <VStack gap={4} align="stretch">
              <HStack>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  style={{ flex: 1 }}
                />
                <Button
                  colorPalette="blue"
                  onClick={handleSubmit}
                  disabled={!file || isLoading}
                  loading={isLoading}
                >
                  読み取り
                </Button>
                {result && (
                  <Button variant="outline" onClick={handleReset}>
                    クリア
                  </Button>
                )}
              </HStack>

              {file && (
                <Text fontSize="sm" color="gray.500">
                  選択中: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </Text>
              )}
            </VStack>
          </Card.Body>
        </Card.Root>

        {error && (
          <Box p={4} bg="red.50" borderRadius="md" borderWidth="1px" borderColor="red.200">
            <Text color="red.600">{error}</Text>
          </Box>
        )}

        {isLoading && (
          <HStack justifyContent="center" py={8}>
            <Spinner />
            <Text>PDF を読み取り中...</Text>
          </HStack>
        )}

        {result && (
          <VStack gap={4} align="stretch">
            <HStack justifyContent="space-between">
              <Heading size="md">抽出結果</Heading>
              <Text fontSize="sm" color="gray.500">
                全 {result.totalPages} ページ
              </Text>
            </HStack>

            <Separator />

            {result.pages.map((page) => (
              <Card.Root key={page.index}>
                <Card.Header pb={2}>
                  <Heading size="sm">ページ {page.index}</Heading>
                </Card.Header>
                <Card.Body pt={0}>
                  {page.text ? (
                    <Box
                      bg="gray.50"
                      p={4}
                      borderRadius="md"
                      maxH="400px"
                      overflowY="auto"
                    >
                      <Text whiteSpace="pre-wrap" fontSize="sm">
                        {page.text}
                      </Text>
                    </Box>
                  ) : (
                    <Text color="gray.400" fontStyle="italic">
                      (テキストなし)
                    </Text>
                  )}
                </Card.Body>
              </Card.Root>
            ))}
          </VStack>
        )}
      </VStack>
    </Container>
  );
}
