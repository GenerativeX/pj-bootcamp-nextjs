import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  CloseButton,
  HStack,
  Icon,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  Separator,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { UseToastOptions } from "@chakra-ui/toast";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
} from "react-icons/fi";
import type { IconType } from "react-icons";

export interface DesignToastHistoryEntry {
  title: string;
  description?: string;
  timestamp: number;
}

interface DesignToastProps {
  status: NonNullable<UseToastOptions["status"]>;
  title: string;
  description?: string;
  count: number;
  history: DesignToastHistoryEntry[];
  onDismiss: () => void;
}

const STATUS_PRESET: Record<
  NonNullable<UseToastOptions["status"]>,
  { accent: string; icon: IconType }
> = {
  success: { accent: "#34C759", icon: FiCheckCircle },
  error: { accent: "#FF453A", icon: FiAlertCircle },
  warning: { accent: "#FFD60A", icon: FiAlertTriangle },
  info: { accent: "#0A84FF", icon: FiInfo },
  loading: { accent: "#5AC8FA", icon: FiInfo },
};

const formatter = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatTimestamp(timestamp: number): string {
  return formatter.format(new Date(timestamp));
}

function ToastCard({
  status,
  title,
  description,
  count,
  onDismiss,
}: Omit<DesignToastProps, "history">) {
  const preset = STATUS_PRESET[status] ?? STATUS_PRESET.info;
  return (
    <Box
      as="output"
      position="relative"
      pl={5}
      pr={4}
      py={3}
      borderRadius="xl"
      bg="rgba(255, 255, 255, 0.82)"
      backdropFilter="blur(18px)"
      border="1px solid rgba(255, 255, 255, 0.6)"
      boxShadow="0 18px 36px rgba(15, 23, 42, 0.14)"
      color="gray.900"
      cursor="default"
      minW="280px"
      maxW="360px"
    >
      <Box
        position="absolute"
        left="0"
        top="12px"
        bottom="12px"
        width="3px"
        borderRadius="full"
        bg={preset.accent}
      />
      <CloseButton
        position="absolute"
        top="10px"
        right="10px"
        size="sm"
        color="gray.500"
        _hover={{ bg: "blackAlpha.50", color: "gray.800" }}
        onClick={onDismiss}
      />
      <HStack align="flex-start" gap={3}>
        <Icon
          as={preset.icon}
          color={preset.accent}
          boxSize={5}
          flexShrink={0}
        />
        <VStack align="flex-start" gap={1} maxW="100%">
          <HStack gap={2} align="baseline">
            <Text
              fontSize="sm"
              fontWeight="semibold"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {title}
            </Text>
            {count > 1 && (
              <Badge
                color="gray.700"
                bg="blackAlpha.100"
                borderRadius="full"
                fontWeight="semibold"
                fontSize="0.7rem"
                px={2}
              >
                ×{count}
              </Badge>
            )}
          </HStack>
          {description && (
            <Text
              fontSize="xs"
              color="gray.600"
              display="-webkit-box"
              overflow="hidden"
              style={{ WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}
            >
              {description}
            </Text>
          )}
        </VStack>
      </HStack>
    </Box>
  );
}

export function DesignToast({
  status,
  title,
  description,
  count,
  history,
  onDismiss,
}: DesignToastProps) {
  const card = (
    <ToastCard
      status={status}
      title={title}
      description={description}
      count={count}
      onDismiss={onDismiss}
    />
  );

  const shouldShowHistory = count > 1 && history.length > 1;

  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 200);
  }, [cancelScheduledClose]);

  const handlePointerEnter = useCallback(() => {
    cancelScheduledClose();
    setIsOpen(true);
  }, [cancelScheduledClose]);

  const handlePointerLeave = useCallback(() => {
    scheduleClose();
  }, [scheduleClose]);

  useEffect(() => {
    if (!shouldShowHistory) {
      return undefined;
    }
    return () => cancelScheduledClose();
  }, [cancelScheduledClose, shouldShowHistory]);

  if (!shouldShowHistory) {
    return card;
  }

  return (
    <PopoverRoot
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
      positioning={{ placement: "right-start" }}
    >
      <PopoverTrigger
        asChild
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {card}
      </PopoverTrigger>
      <PopoverPositioner
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <PopoverContent
          width="260px"
          bg="rgba(255, 255, 255, 0.9)"
          backdropFilter="blur(16px)"
          color="gray.900"
          border="1px solid rgba(255, 255, 255, 0.6)"
          boxShadow="0 18px 40px rgba(15, 23, 42, 0.12)"
          borderRadius="xl"
          _focus={{ boxShadow: "none" }}
        >
          <PopoverArrow />
          <PopoverBody>
            <VStack
              align="stretch"
              gap={2}
              separator={<Separator borderColor="blackAlpha.100" />}
            >
              {history.slice(0, 3).map((entry, index) => (
                <Box key={`${entry.timestamp}-${index}`}>
                  <Text fontSize="xs" color="gray.500" letterSpacing="0.02em">
                    {formatTimestamp(entry.timestamp)}
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" mt={0.5}>
                    {entry.title}
                  </Text>
                  {entry.description && (
                    <Text
                      fontSize="xs"
                      color="gray.600"
                      mt={0.5}
                      display="-webkit-box"
                      overflow="hidden"
                      style={{
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {entry.description}
                    </Text>
                  )}
                </Box>
              ))}
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </PopoverPositioner>
    </PopoverRoot>
  );
}
