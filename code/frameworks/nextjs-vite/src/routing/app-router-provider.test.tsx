import { describe, expect, it } from 'vitest';

import React, { useContext } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { Addon_StoryContext } from 'storybook/internal/types';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore we must ignore types here as during compilation they are not generated yet
import { createNavigation } from '@storybook/nextjs-vite/navigation.mock';

import { useRouter } from 'next/navigation';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';

import { RouterDecorator } from './decorator.tsx';

const renderAppDirectoryStory = (Story: React.FC) => {
  createNavigation(undefined);

  const rendered = RouterDecorator(Story, {
    parameters: { nextjs: { appDirectory: true } },
  } as unknown as Addon_StoryContext);

  return renderToStaticMarkup(<>{rendered}</>);
};

describe('RouterDecorator with parameters.nextjs.appDirectory: true', () => {
  it('exposes parentRenderTree.data.bfcacheId via LayoutRouterContext', () => {
    const Probe = () => {
      // `parentRenderTree` is only in the LayoutRouterContext type of Next.js >= v16.4
      const layoutRouterContext = useContext(LayoutRouterContext) as unknown as {
        parentRenderTree?: { data?: { bfcacheId?: number } };
      } | null;
      return <span>{String(layoutRouterContext?.parentRenderTree?.data?.bfcacheId)}</span>;
    };

    expect(renderAppDirectoryStory(Probe)).toBe('<span>0</span>');
  });

  // The regression requires Next.js >= 16.4; the first test guards the missing context field.
  it('supports useRouter() consumers', () => {
    const Probe = () => {
      const router = useRouter();
      return <span>{typeof router.push}</span>;
    };

    expect(renderAppDirectoryStory(Probe)).toBe('<span>function</span>');
  });
});
