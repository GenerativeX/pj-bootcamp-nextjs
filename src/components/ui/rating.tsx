import { RatingGroup } from "@chakra-ui/react";
import * as React from "react";

export interface RatingProps extends RatingGroup.RootProps {
  icon?: React.ReactElement;
  count?: number;
  label?: React.ReactNode;
}

export const Rating = React.forwardRef<HTMLDivElement, RatingProps>(
  function Rating(props, ref) {
    const { icon, count = 5, label, ...rest } = props;
    const keys = React.useMemo(
      () => Array.from({ length: count }, (_, i) => `rating-${i + 1}`),
      [count],
    );
    return (
      <RatingGroup.Root ref={ref} count={count} {...rest}>
        {label && <RatingGroup.Label>{label}</RatingGroup.Label>}
        <RatingGroup.HiddenInput />
        <RatingGroup.Control>
          {keys.map((key, index) => (
            <RatingGroup.Item key={key} index={index + 1}>
              <RatingGroup.ItemIndicator icon={icon} />
            </RatingGroup.Item>
          ))}
        </RatingGroup.Control>
      </RatingGroup.Root>
    );
  },
);
