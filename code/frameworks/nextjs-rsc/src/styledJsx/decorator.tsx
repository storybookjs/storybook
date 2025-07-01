'use client';

import { type ReactNode } from 'react';

// @ts-expect-error no types
import * as React from 'next/dist/compiled/react';
import { StyleRegistry } from 'styled-jsx';

export const StyledJsxDecorator = ({ children }: { children: ReactNode }): ReactNode => (
  <StyleRegistry>{children}</StyleRegistry>
);
