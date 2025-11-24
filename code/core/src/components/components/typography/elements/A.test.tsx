// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { A } from './A';

function ThemedA({ children, ...props }: React.ComponentProps<typeof A>) {
  return (
    <ThemeProvider theme={convert(themes.light)}>
      <A {...props}>{children}</A>
    </ThemeProvider>
  );
}

describe('A', () => {
  afterEach(() => {
    cleanup();
  });

  describe('accessibility', () => {
    it('should render with underline text decoration for accessibility', () => {
      const { container } = render(<ThemedA href="https://example.com">Test Link</ThemedA>);

      const link = container.querySelector('a');
      expect(link).toBeTruthy();

      const styles = window.getComputedStyle(link!);
      expect(styles.textDecoration).toContain('underline');
    });

    it('should render with underline in dark theme', () => {
      const { container } = render(
        <ThemeProvider theme={convert(themes.dark)}>
          <A href="https://example.com">Test Link</A>
        </ThemeProvider>
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();

      const styles = window.getComputedStyle(link!);
      expect(styles.textDecoration).toContain('underline');
    });

    it('should not underline anchor position markers (a.anchor)', () => {
      const { container } = render(
        <ThemedA href="#heading" className="anchor">
          Anchor Link
        </ThemedA>
      );

      const link = container.querySelector('a.anchor');
      expect(link).toBeTruthy();

      const styles = window.getComputedStyle(link!);
      // Anchor links are position markers and should not have underline
      expect(styles.textDecoration).not.toContain('underline');
    });

    it('should render with correct color and styling', () => {
      const { container } = render(<ThemedA href="https://example.com">Link Text</ThemedA>);

      const link = container.querySelector('a');
      expect(link).toBeTruthy();
      expect(link?.textContent).toBe('Link Text');

      const styles = window.getComputedStyle(link!);
      expect(styles.textDecoration).toContain('underline');
      expect(styles.fontSize).toBe('inherit');
    });
  });
});
