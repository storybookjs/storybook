import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
}

// JSX-children shape: the child tree is not representable as serializable args.
export function Card({ children }: CardProps) {
  return (
    <section style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16 }}>{children}</section>
  );
}
