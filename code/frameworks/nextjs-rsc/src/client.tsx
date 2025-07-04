'use client';

import { type ReactNode } from 'react';

import { type StoryContext } from 'storybook/internal/types';

// @ts-expect-error no types
import * as React from 'next/dist/compiled/react';
import { StyleRegistry } from 'styled-jsx';

import HeadManagerProvider from './head-manager/head-manager-provider';
import { ImageDecorator } from './images/decorator';
import { RouterDecorator } from './routing/decorator';

export const ClientWrapper = ({
  children,
  nextjs,
}: {
  children: ReactNode;
  nextjs: StoryContext['parameters']['nextjs'];
}) => (
  <StyleRegistry>
    <ImageDecorator nextjs={nextjs}>
      <RouterDecorator nextjs={nextjs}>
        <HeadManagerProvider>{children}</HeadManagerProvider>
      </RouterDecorator>
    </ImageDecorator>
  </StyleRegistry>
);
