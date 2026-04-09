import { useCallback, useMemo } from "react";
import { useToast, type ToastId, type UseToastOptions } from "@chakra-ui/toast";
import {
  DesignToast,
  type DesignToastHistoryEntry,
} from "@/components/DesignToast";

type Status = Exclude<UseToastOptions["status"], undefined>;

type UseDesignToastReturn = ReturnType<typeof useToast>;

type DesignToastOptions = UseToastOptions & {
  groupKey?: string;
};

interface ToastGroupState {
  id: ToastId;
  key: string;
  status: Status;
  title: string;
  description?: string;
  count: number;
  history: DesignToastHistoryEntry[];
}

const STATUS_DURATION: Record<Status, number> = {
  info: 3000,
  success: 3000,
  warning: 4000,
  error: 5000,
  loading: 3000,
};

const DEFAULT_TITLE: Record<Status, string> = {
  info: "通知",
  success: "完了",
  warning: "注意",
  error: "エラー",
  loading: "処理中",
};

const toastGroups = new Map<string, ToastGroupState>();

function resolveDuration(
  options: DesignToastOptions,
  fallback?: DesignToastOptions,
): number | undefined {
  if (typeof options.duration === "number") {
    return options.duration;
  }
  if (fallback?.duration) {
    return fallback.duration;
  }
  const status = options.status ?? fallback?.status;
  if (status) {
    return STATUS_DURATION[status] ?? STATUS_DURATION.info;
  }
  return STATUS_DURATION.info;
}

function mergeOptions(
  base: DesignToastOptions | undefined,
  next: DesignToastOptions,
): DesignToastOptions {
  const duration = resolveDuration(next, base);
  return {
    position: base?.position ?? "top",
    isClosable: base?.isClosable ?? true,
    variant: "unstyled",
    ...base,
    ...next,
    duration,
  };
}

const MAX_HISTORY = 3;

function buildHistoryEntry(
  title: string,
  description?: string,
): DesignToastHistoryEntry {
  return {
    title,
    description,
    timestamp: Date.now(),
  };
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getGroupKey(
  options: DesignToastOptions,
  status: Status,
  title: string,
  description?: string,
): string {
  if (options.groupKey) {
    return options.groupKey;
  }
  if (options.id) {
    return String(options.id);
  }
  if (title) {
    return `${status}:${title}`;
  }
  if (description) {
    return `${status}:${description}`;
  }
  return `${status}:${Date.now()}`;
}

function createRender(state: ToastGroupState, description: string | undefined) {
  const RenderToast = ({ onClose }: { onClose: () => void }) => (
    <DesignToast
      status={state.status}
      title={state.title}
      description={description}
      count={state.count}
      history={state.history}
      onDismiss={onClose}
    />
  );
  RenderToast.displayName = "DesignToastRender";
  return RenderToast;
}

/**
 * デザイン仕様に基づき、トーストの見た目と集約ルールを統一するカスタムフック。
 */
export function useDesignToast(
  defaultOptions?: DesignToastOptions,
): UseDesignToastReturn {
  const chakraToast = useToast(defaultOptions);

  const show = useCallback(
    (options?: DesignToastOptions) => {
      const merged = mergeOptions(defaultOptions, options ?? {});
      const status = (merged.status ?? "info") as Status;
      const title =
        extractString(merged.title) ??
        extractString(defaultOptions?.title) ??
        DEFAULT_TITLE[status];
      const description =
        extractString(merged.description) ??
        extractString(defaultOptions?.description);

      const groupKey = getGroupKey(merged, status, title, description);
      const entry = buildHistoryEntry(title, description);

      const existing = toastGroups.get(groupKey);
      if (existing && chakraToast.isActive(existing.id)) {
        const updatedState: ToastGroupState = {
          ...existing,
          count: existing.count + 1,
          status,
          title,
          description,
          history: [entry, ...existing.history].slice(0, MAX_HISTORY),
        };
        toastGroups.set(groupKey, updatedState);
        chakraToast.update(existing.id, {
          duration: merged.duration,
          status,
          render: createRender(updatedState, description),
        });
        return existing.id;
      }

      const state: ToastGroupState = {
        id: "",
        key: groupKey,
        status,
        title,
        description,
        count: 1,
        history: [entry],
      };

      const {
        groupKey: _groupKey,
        title: _title,
        description: _description,
        render: _render,
        ...rest
      } = merged;

      const toastId = chakraToast({
        ...rest,
        status,
        duration: merged.duration,
        variant: "unstyled",
        render: createRender(state, description),
        onCloseComplete: () => {
          const latest = toastGroups.get(groupKey);
          if (latest && latest.id === toastId) {
            toastGroups.delete(groupKey);
          }
          merged.onCloseComplete?.();
        },
      });

      state.id = toastId;
      toastGroups.set(groupKey, state);
      return toastId;
    },
    [chakraToast, defaultOptions],
  );

  const designToast = useMemo(() => {
    const bound = Object.assign(
      (options?: DesignToastOptions) => show(options),
      {
        close: chakraToast.close,
        closeAll: chakraToast.closeAll,
        update: chakraToast.update,
        isActive: chakraToast.isActive,
        promise: chakraToast.promise.bind(chakraToast),
      },
    ) as UseDesignToastReturn;
    return bound;
  }, [chakraToast, show]);

  return designToast;
}
