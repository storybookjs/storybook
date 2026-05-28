// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { ZoomElement } from './ZoomElement.tsx';

function renderZoomElement(scale: number) {
  return render(
    <ThemeProvider theme={convert(themes.light)}>
      <ZoomElement scale={scale}>
        <div>Zoom content</div>
      </ZoomElement>
    </ThemeProvider>
  );
}

describe('ZoomElement', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not create a transformed containing block at actual size', () => {
    const { container } = renderZoomElement(1);

    expect(window.getComputedStyle(container.firstElementChild!).transform).toBe('');
  });

  it('applies transform when zoomed', () => {
    const { container } = renderZoomElement(2);

    expect(window.getComputedStyle(container.firstElementChild!).transform).toBe('scale(0.5)');
  });
});
