// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import React from 'react';

import { ThemeProvider, convert, themes } from 'storybook/theming';

import { DocumentWrapper } from './DocumentWrapper';

function ThemedDocumentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={convert(themes.light)}>
      <DocumentWrapper>{children}</DocumentWrapper>
    </ThemeProvider>
  );
}

describe('DocumentWrapper', () => {
  afterEach(() => {
    cleanup();
  });

  describe('accessibility', () => {
    it('should render links with underline text decoration for accessibility', () => {
      const { container } = render(
        <ThemedDocumentWrapper>
          <p>
            This is a paragraph with a <a href="https://example.com">link</a> inside.
          </p>
        </ThemedDocumentWrapper>
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();

      // Get computed styles
      const styles = window.getComputedStyle(link!);
      
      // Verify that links have underline decoration for WCAG 2.1 Level A compliance
      // (Success Criterion 1.4.1 - Use of Color)
      expect(styles.textDecoration).toContain('underline');
    });

    it('should render links with underline in dark theme', () => {
      const { container } = render(
        <ThemeProvider theme={convert(themes.dark)}>
          <DocumentWrapper>
            <p>
              This is a paragraph with a <a href="https://example.com">link</a> inside.
            </p>
          </DocumentWrapper>
        </ThemeProvider>
      );

      const link = container.querySelector('a');
      expect(link).toBeTruthy();

      const styles = window.getComputedStyle(link!);
      expect(styles.textDecoration).toContain('underline');
    });

    it('should render multiple links with underlines in text blocks', () => {
      const { container } = render(
        <ThemedDocumentWrapper>
          <div>
            <p>
              Check out <a href="https://example.com">this link</a> and also{' '}
              <a href="https://another.com">this other link</a>.
            </p>
            <p>
              Here is <a href="https://third.com">a third link</a> in another paragraph.
            </p>
          </div>
        </ThemedDocumentWrapper>
      );

      const links = container.querySelectorAll('a');
      expect(links).toHaveLength(3);

      links.forEach((link) => {
        const styles = window.getComputedStyle(link);
        expect(styles.textDecoration).toContain('underline');
      });
    });
  });
});

