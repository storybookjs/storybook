import type { ReactNode } from 'react';
import { accentColor, accentContrastColor, neutralColor } from '../theme/colors';

export type BadgeProps = {
  children: ReactNode;
  variant?: 'accent' | 'neutral';
};

export default function Badge({ children, variant = 'accent' }: BadgeProps) {
  const background = variant === 'accent' ? accentColor : neutralColor;

  return (
    <span
      data-testid="badge"
      style={{
        backgroundColor: background,
        color: accentContrastColor,
        borderRadius: 999,
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 600,
        padding: '2px 10px',
      }}
    >
      {children}
    </span>
  );
}
