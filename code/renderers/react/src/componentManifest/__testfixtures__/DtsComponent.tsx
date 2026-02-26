import type { ButtonHTMLAttributes } from 'react';

interface HtmlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The button variant */
  variant?: 'solid' | 'outline';
}

export function HtmlButton(_props: HtmlButtonProps) {
  return null;
}
