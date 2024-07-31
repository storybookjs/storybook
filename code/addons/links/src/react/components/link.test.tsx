// @vitest-environment happy-dom

/// <reference types="@testing-library/jest-dom" />;
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { addons } from 'storybook/internal/preview-api';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SELECT_STORY } from 'storybook/internal/core-events';
import LinkTo from './link';

vi.mock('storybook/internal/preview-api');
vi.mock('@storybook/global', () => ({
  global: {
    document: {
      location: {
        origin: 'origin',
        pathname: 'pathname',
        search: 'search',
      },
    },
  },
}));

const mockChannel = () => {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
  };
};
const mockAddons = vi.mocked(addons);

describe('LinkTo', () => {
  describe('render', () => {
    afterEach(() => {
      cleanup();
    });
    it('should render a link', async () => {
      const channel = mockChannel() as any;
      mockAddons.getChannel.mockReturnValue(channel);

      const { container } = render(
        // eslint-disable-next-line jsx-a11y/anchor-is-valid
        <LinkTo title="foo" name="bar">
          link
        </LinkTo>
      );

      await waitFor(() => {
        expect(screen.getByText('link')).toHaveAttribute(
          'href',
          'originpathname?path=/story/foo--bar'
        );
      });
      expect(container.firstChild).toMatchInlineSnapshot(`
        <a
          href="originpathname?path=/story/foo--bar"
        >
          link
        </a>
      `);
    });
  });

  describe('events', () => {
    it('should select the kind and story on click', async () => {
      const channel = {
        emit: vi.fn(),
        on: vi.fn(),
      } as any;
      mockAddons.getChannel.mockReturnValue(channel);

      await act(async () => {
        await render(
          // eslint-disable-next-line jsx-a11y/anchor-is-valid
          <LinkTo title="foo" name="bar">
            link
          </LinkTo>
        );
      });

      expect(screen.getByText('link')).toHaveAttribute(
        'href',
        'originpathname?path=/story/foo--bar'
      );

      await userEvent.click(screen.getByText('link'));

      expect(channel.emit).toHaveBeenLastCalledWith(
        SELECT_STORY,
        expect.objectContaining({
          title: 'foo',
          name: 'bar',
        })
      );
    });
  });
});
