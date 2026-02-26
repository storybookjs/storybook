import type { ClickableProps, SharedProps } from './types';

type CardProps = Pick<SharedProps, 'id'> &
  Omit<ClickableProps, 'disabled'> & {
    title: string;
    subtitle?: string;
  };

export function Card(_props: CardProps) {
  return null;
}
