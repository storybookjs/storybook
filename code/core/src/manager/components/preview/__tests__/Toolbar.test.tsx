// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import React from 'react';

import { Addon_TypesEnum, type Addon_BaseType } from 'storybook/internal/types';
import { ThemeProvider, ensure, themes } from 'storybook/theming';

import { ToolbarComp } from '../Toolbar.tsx';

// The toolbar is only shown when it has a tool to show.
const tool: Addon_BaseType = {
  id: 'test-tool',
  type: Addon_TypesEnum.TOOL,
  title: 'Test tool',
  render: () => <span>tool</span>,
};

/**
 * `@react-aria/landmark` keeps its registry on the document under this symbol, and only creates it
 * once a landmark registers. So its presence after a render tells whether `useLandmark` ran.
 */
const LANDMARK_MANAGER = Symbol.for('react-aria-landmark-manager');
const landmarkManager = () => (document as unknown as Record<symbol, unknown>)[LANDMARK_MANAGER];

const renderToolbar = (isShown: boolean) =>
  render(
    <ThemeProvider theme={ensure(themes.light)}>
      <ToolbarComp isShown={isShown} tools={[tool]} toolsExtra={[]} />
    </ThemeProvider>
  );

describe('ToolbarComp', () => {
  afterEach(cleanup);

  test('does not register a landmark while hidden', () => {
    // A landmark registered for an element that never mounts has a null node, and
    // @react-aria/landmark crashes on it the next time any landmark is registered,
    // for example when the sidebar is shown again (#36470).
    renderToolbar(false);

    expect(screen.queryByTestId('sb-preview-toolbar')).toBeNull();
    expect(landmarkManager()).toBeUndefined();
  });

  test('registers the toolbar as a landmark while shown', () => {
    renderToolbar(true);

    expect(screen.getByTestId('sb-preview-toolbar').getAttribute('data-sb-landmark')).toBe('true');
    expect(landmarkManager()).toBeDefined();
  });
});
