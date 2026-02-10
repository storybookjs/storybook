import type { ClickableProps, SharedProps, Variant } from './types';

interface BadgeProps extends SharedProps, ClickableProps {
  /** The badge label */
  label: string;
  variant: Variant;
  count?: number;
}

export function Badge(props: BadgeProps) {
  return null;
}
