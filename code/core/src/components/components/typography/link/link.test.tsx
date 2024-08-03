// @vitest-environment happy-dom

import { vi, describe, afterEach, it, expect } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, themes, convert } from '@storybook/core/theming';
import type { LinkProps } from './link';
import { Link } from './link';

function ThemedLink(props: LinkProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <ThemeProvider theme={convert(themes.light)}>
      <Link {...props} />
    </ThemeProvider>
  );
}

async function click(target: Element, button: string, modifier?: string) {
  const user = userEvent.setup();
  if (modifier) {
    // Trailing > means to leave it pressed
    await user.keyboard(`{${modifier}>}`);
  }
  await user.pointer([{ target }, { keys: `[${button}]`, target }]);
  if (modifier) {
    // Leading / means to release it
    await user.keyboard(`{/${modifier}}`);
  }
}

describe('Link', () => {
  afterEach(() => {
    cleanup();
  });

  describe('events', () => {
    it('should call onClick on a plain left click', async () => {
      const handleClick = vi.fn();
      render(<ThemedLink onClick={handleClick}>Content</ThemedLink>);
      await click(screen.getByText('Content'), 'MouseLeft');
      expect(handleClick).toHaveBeenCalled();
    });

    it("shouldn't call onClick on a middle click", async () => {
      const handleClick = vi.fn();
      render(<ThemedLink onClick={handleClick}>Content</ThemedLink>);
      await click(screen.getByText('Content'), 'MouseMiddle');
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("shouldn't call onClick on a right click", async () => {
      const handleClick = vi.fn();
      render(<ThemedLink onClick={handleClick}>Content</ThemedLink>);
      await click(screen.getByText('Content'), 'MouseRight');
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("shouldn't call onClick on alt+click", async () => {
      const handleClick = vi.fn();
      render(<ThemedLink onClick={handleClick}>Content</ThemedLink>);
      await click(screen.getByText('Content'), 'MouseLeft', 'Alt');
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("shouldn't call onClick on ctrl+click", async () => {
      const handleClick = vi.fn();
      render(<ThemedLink onClick={handleClick}>Content</ThemedLink>);
      await click(screen.getByText('Content'), 'MouseLeft', 'Control');
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("shouldn't call onClick on cmd+click / win+click", async () => {
      const handleClick = vi.fn();
      render(<ThemedLink onClick={handleClick}>Content</ThemedLink>);
      await click(screen.getByText('Content'), 'MouseLeft', 'Meta');
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("shouldn't call onClick on shift+click", async () => {
      const handleClick = vi.fn();
      render(<ThemedLink onClick={handleClick}>Content</ThemedLink>);
      await click(screen.getByText('Content'), 'MouseLeft', 'Shift');
      expect(handleClick).not.toHaveBeenCalled();
    });
  });
});
