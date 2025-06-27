'use client';

import * as React from 'react';

import { StyleRegistry } from 'styled-jsx';

export const StyledJsxDecorator = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => <StyleRegistry>{children}</StyleRegistry>;
