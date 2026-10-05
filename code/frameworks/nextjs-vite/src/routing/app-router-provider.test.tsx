import { beforeEach, describe, expect, it } from 'vitest';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { createNavigation } from '../export-mocks/navigation/index.ts';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';

import { AppRouterProvider } from './app-router-provider.tsx';

type MockedLayoutRouterContext = {
  parentRenderTree?: { data?: { bfcacheId?: number } };
  parentCacheNode?: unknown;
};

const LayoutRouterContextConsumer = LayoutRouterContext.Consumer as unknown as React.FC<{
  children: (value: MockedLayoutRouterContext) => React.ReactElement;
}>;

const renderLayoutRouterContext = () =>
  renderToStaticMarkup(
    <AppRouterProvider routeParams={{ pathname: '/test', query: {} }}>
      <LayoutRouterContextConsumer>
        {(value) => (
          <span
            data-has-parent-render-tree={String(value.parentRenderTree !== undefined)}
            data-bfcache-id={String(value.parentRenderTree?.data?.bfcacheId)}
            data-has-parent-cache-node={String(value.parentCacheNode !== undefined)}
          />
        )}
      </LayoutRouterContextConsumer>
    </AppRouterProvider>
  );

describe('AppRouterProvider', () => {
  beforeEach(() => {
    createNavigation(undefined);
  });

  it('provides parentRenderTree.data.bfcacheId for Next.js 16.4+ useRouter', () => {
    const html = renderLayoutRouterContext();

    expect(html).toContain('data-has-parent-render-tree="true"');
    expect(html).toContain('data-bfcache-id="0"');
  });

  it('keeps parentCacheNode for Next.js < 16.4', () => {
    expect(renderLayoutRouterContext()).toContain('data-has-parent-cache-node="true"');
  });
});
