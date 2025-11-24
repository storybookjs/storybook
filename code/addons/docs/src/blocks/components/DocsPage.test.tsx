// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { DocsContent } from './DocsPage';

function ThemedDocsContent({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={convert(themes.light)}>
      <DocsContent>{children}</DocsContent>
    </ThemeProvider>
  );
}

describe('DocsContent', () => {
  afterEach(() => {
    cleanup();
  });

  describe('accessibility', () => {
    it('should render links with underline text decoration for accessibility', () => {
      const { container } = render(
        <ThemedDocsContent>
          <p>
            This is a paragraph with a <a href="https://example.com">link</a> inside.
          </p>
        </ThemedDocsContent>
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();

      const styles = window.getComputedStyle(link!);
      expect(styles.textDecoration).toContain('underline');
    });

    it('should render links with underline in dark theme', () => {
      const { container } = render(
        <ThemeProvider theme={convert(themes.dark)}>
          <DocsContent>
            <p>
              This is a paragraph with a <a href="https://example.com">link</a> inside.
            </p>
          </DocsContent>
        </ThemeProvider>
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();

      const styles = window.getComputedStyle(link!);
      expect(styles.textDecoration).toContain('underline');
    });

    it('should render multiple links with underlines in text blocks', () => {
      const { container } = render(
        <ThemedDocsContent>
          <div>
            <p>
              Check out <a href="https://example.com">this link</a> and also{' '}
              <a href="https://another.com">this other link</a>.
            </p>
            <p>
              Here is <a href="https://third.com">a third link</a> in another paragraph.
            </p>
          </div>
        </ThemedDocsContent>
      );

      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(3);

      links.forEach((link) => {
        const styles = window.getComputedStyle(link);
        expect(styles.textDecoration).toContain('underline');
      });
    });

    it('should not underline anchor position markers (a.anchor)', () => {
      const { container } = render(
        <ThemedDocsContent>
          <h2>
            <a className="anchor" href="#heading">
              Heading
            </a>
          </h2>
        </ThemedDocsContent>
      );

      const anchor = container.querySelector('a.anchor');
      expect(anchor).toBeTruthy();

      const styles = window.getComputedStyle(anchor!);
      // Anchor links should not have underline by default as per DocsPage.tsx styling
      expect(styles.textDecoration).not.toContain('underline');
    });
  });
});
