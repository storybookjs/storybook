// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import React from 'react';

import { ThemeProvider, ensure, themes } from '@storybook/core/theming';
import type { Theme } from '@storybook/core/theming';
import type { API_IndexHash } from '@storybook/core/types';

import type { HashEntry, Refs } from '@storybook/core/manager-api';

import { Sidebar } from '../Sidebar';
import type { SidebarProps } from '../Sidebar';

const DOCS_NAME = 'Docs';

const factory = (props: Partial<SidebarProps>): RenderResult => {
  const theme: Theme = ensure(themes.light);

  return render(
    <ThemeProvider theme={theme}>
      <Sidebar
        menu={[]}
        index={{}}
        previewInitialized
        refs={{}}
        status={{}}
        extra={[]}
        {...props}
      />
    </ThemeProvider>
  );
};

const generateStories = ({ title, refId }: { title: string; refId?: string }): API_IndexHash => {
  const [root, componentName]: [string, string] = title.split('/') as any;
  const rootId: string = root.toLowerCase().replace(/\s+/g, '-');
  const hypenatedComponentName: string = componentName.toLowerCase().replace(/\s+/g, '-');
  const componentId = `${rootId}-${hypenatedComponentName}`;
  const docsId = `${rootId}-${hypenatedComponentName}--docs`;

  const storyBase: HashEntry[] = [
    {
      type: 'root',
      id: rootId,
      depth: 0,
      refId,
      name: root,
      children: [componentId],
      startCollapsed: false,
    },
    {
      type: 'component',
      id: componentId,
      depth: 1,
      refId,
      name: componentName,
      children: [docsId],
      parent: rootId,
    },
    // @ts-expect-error the missing fields are deprecated and replaced by the type prop
    {
      type: 'docs',
      id: docsId,
      depth: 2,
      refId,
      name: DOCS_NAME,
      title,
      parent: componentId,
      importPath: './docs.js',
    },
  ];

  return storyBase.reduce((accumulator: API_IndexHash, current: HashEntry): API_IndexHash => {
    accumulator[current.id] = current;
    return accumulator;
  }, {});
};

describe('Sidebar', () => {
  afterEach(() => {
    cleanup();
  });

  // TODO: Bring this test back whenever possible.
  // Seems to be failing because of two reasons:
  // - There is a warning "ReactDOM.render is no longer supported in React 18. Use createRoot instead."
  // - There is a TypeError: Cannot read properties of undefined (reading 'size') - coming from ThemeProvider
  test.skip("should not render an extra nested 'Page'", async () => {
    const refId = 'next';
    const title = 'Getting Started/Install';
    const refIndex: API_IndexHash = generateStories({ refId, title });
    const internalIndex: API_IndexHash = generateStories({ title: 'Welcome/Example' });

    const refs: Refs = {
      [refId]: {
        index: refIndex,
        id: refId,
        previewInitialized: true,
        title: refId,
        url: 'https://ref.url',
      },
    };

    factory({
      refs,
      refId,
      index: internalIndex,
    });

    fireEvent.click(screen.getByText('Install'));
    fireEvent.click(screen.getByText('Example'));

    const pageItems: HTMLElement[] = await screen.queryAllByText('Page');

    expect(pageItems).toHaveLength(0);
  });
});
