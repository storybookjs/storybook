import type { ReactNode } from 'react';
import React from 'react';

interface Props {
  hidden: boolean;
  children: ReactNode;
}

export const ToggleVisibility = ({ hidden, children }: Props) => (
  <div hidden={hidden}>{children}</div>
);
