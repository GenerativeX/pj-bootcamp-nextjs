import {
  Tooltip as ChakraTooltip,
  type TooltipContentProps,
  type TooltipRootProps,
} from "@chakra-ui/react";
import type { Placement } from "@zag-js/popper";
import type { ReactNode } from "react";

export interface SimpleTooltipProps
  extends Omit<TooltipRootProps, "children" | "positioning"> {
  label: ReactNode;
  children: ReactNode;
  /**
   * Tooltip の表示位置。旧 API の `placement` 相当。
   */
  placement?: Placement;
  /**
   * 旧 API の `hasArrow` 相当。true の場合のみ矢印を表示する。
   */
  hasArrow?: boolean;
  /**
   * Tooltip 内容に適用したい追加 props。
   */
  contentProps?: Omit<TooltipContentProps, "children">;
  /**
   * 旧 API の `isDisabled` 互換。
   */
  isDisabled?: boolean;
  positioning?: TooltipRootProps["positioning"];
}

/**
 * Chakra UI v2 の `Tooltip` コンポーネント互換レイヤー。
 * v3 の新 API を内部で利用しつつ、従来と同じインターフェースで扱えるようにする。
 */
export function Tooltip({
  label,
  children,
  placement,
  hasArrow = false,
  contentProps,
  isDisabled,
  positioning,
  ...rootProps
}: SimpleTooltipProps) {
  if (isDisabled) {
    return <>{children}</>;
  }

  const resolvedPositioning =
    placement || positioning
      ? { ...positioning, placement: placement ?? positioning?.placement }
      : undefined;

  return (
    <ChakraTooltip.Root {...rootProps} positioning={resolvedPositioning}>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <ChakraTooltip.Positioner>
        <ChakraTooltip.Content {...contentProps}>
          {label}
          {hasArrow ? <ChakraTooltip.Arrow /> : null}
        </ChakraTooltip.Content>
      </ChakraTooltip.Positioner>
    </ChakraTooltip.Root>
  );
}
