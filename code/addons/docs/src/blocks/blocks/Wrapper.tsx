import type { FC } from 'react';
import React from 'react';

export const Wrapper: FC<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
> = ({ children }) => <div style={{ fontFamily: 'sans-serif' }}>{children}</div>;
