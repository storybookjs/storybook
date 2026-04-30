// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import React from 'react';

import { ensure, themes } from 'storybook/theming';
import type { Theme } from 'storybook/theming';

type GlobalStyles = (theme: Theme) => Record<string, Record<string, unknown>>;

let getGlobalStyles: GlobalStyles | undefined;

vi.mock('storybook/theming', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/theming')>();

  return {
    ...actual,
    Global: ({ styles }: { styles: GlobalStyles }) => {
      getGlobalStyles = styles;
      return null;
    },
  };
});

import { HighlightStyles } from '../HighlightStyles.tsx';

describe('HighlightStyles', () => {
  afterEach(() => {
    cleanup();
    getGlobalStyles = undefined;
  });

  test('keeps the keyboard highlight visible when the highlighted sidebar item is selected', () => {
    render(<HighlightStyles refId="foo" itemId="bar" />);

    const selector = '[data-ref-id="foo"][data-item-id="bar"][data-selected="true"]';
    const styles = getGlobalStyles?.(ensure(themes.light));

    expect(styles?.[selector]).toMatchObject({
      boxShadow: expect.stringContaining('inset 0 0 0 2px'),
    });
  });
});
