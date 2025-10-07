import React, { type ReactNode } from 'react';

import { NextRouter } from '@storybook/nextjs-vite-rsc/rsc/client';

export const ServerComponent = ({ children }: { children: ReactNode }) => (
  <NextRouter>{children}</NextRouter>
);
