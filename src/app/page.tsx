"use client";

import { Box, Container, Heading, Text, VStack } from "@chakra-ui/react";
import { FiCode, FiMonitor } from "react-icons/fi";

export default function Home() {
  return (
    <Container maxW="container.md" py={20}>
      <VStack gap={8} align="center">
        <VStack gap={3}>
          <Heading
            as="h1"
            fontSize={{ base: "3xl", md: "4xl" }}
            fontWeight="bold"
            letterSpacing="tight"
            textAlign="center"
            color="#00338D"
          >
            AI coding camp
          </Heading>
          <Text
            fontSize={{ base: "md", md: "lg" }}
            color="fg.muted"
            textAlign="center"
          >
            ローカル開発環境
          </Text>
        </VStack>

        <Box
          w="full"
          maxW="md"
          p={8}
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
        >
          <VStack gap={5} align="start">
            <Box display="flex" alignItems="center" gap={3}>
              <Box as={FiMonitor} boxSize={5} color="fg.muted" />
              <Text fontSize="sm" color="fg.muted">
                Cursor エージェントモードで編集
              </Text>
            </Box>
            <Box display="flex" alignItems="center" gap={3}>
              <Box as={FiCode} boxSize={5} color="fg.muted" />
              <Text fontSize="sm" color="fg.muted">
                ローカル利用を前提とした開発用プロジェクト
              </Text>
            </Box>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
}
