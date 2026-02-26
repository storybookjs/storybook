import type { ClickableProps, SharedProps, Variant } from './types';

interface BadgeProps extends SharedProps, ClickableProps {
  /** The badge label */
  label: string;
  variant: Variant;
  count?: number;
}

export function Badge(_props: BadgeProps) {
  return null;
}
