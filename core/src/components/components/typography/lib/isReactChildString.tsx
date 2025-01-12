import type { ReactNode } from 'react';

export const isReactChildString = (child: ReactNode): child is string => typeof child === 'string';
