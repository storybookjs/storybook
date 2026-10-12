// @vitest-environment happy-dom
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import type { ChannelTransport } from 'storybook/internal/channels';
import * as common from 'storybook/internal/common';
import type {
  FileComponentSearchRequestPayload,
  RequestData,
} from 'storybook/internal/core-events';
import {
  FILE_COMPONENT_SEARCH_REQUEST,
  FILE_COMPONENT_SEARCH_RESPONSE,
} from 'storybook/internal/core-events';
import { logger } from 'storybook/internal/node-logger';
import { SupportedRenderer } from 'storybook/internal/types';

import { searchFiles } from '../utils/search-files.ts';
import { initFileSearchChannel } from './file-search-channel.ts';

vi.mock(import('../utils/search-files.ts'), async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, searchFiles: vi.fn(original.searchFiles) };
});

vi.mock('storybook/internal/common');
vi.mock('storybook/internal/node-logger');

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(common.getFrameworkName).mockResolvedValue('@storybook/react');
  vi.mocked(common.extractRenderer).mockResolvedValue(SupportedRenderer.REACT);
  vi.spyOn(common, 'getProjectRoot').mockReturnValue(
    require('path').join(__dirname, '..', 'utils', '__search-files-tests__')
  );
});

describe('file-search-channel', () => {
  const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
  const mockChannel = new Channel({ transport });
  const searchResultChannelListener = vi.fn();

  describe('initFileSearchChannel', async () => {
    it('should emit search result event with the search result', { timeout: 10000 }, async () => {
      const mockOptions = {};
      const data = { searchQuery: 'es-module' };

      await initFileSearchChannel(mockChannel, mockOptions as any);

      mockChannel.addListener(FILE_COMPONENT_SEARCH_RESPONSE, searchResultChannelListener);
      mockChannel.emit(FILE_COMPONENT_SEARCH_REQUEST, {
        id: data.searchQuery,
        payload: {},
      } satisfies RequestData<FileComponentSearchRequestPayload>);

      await vi.waitFor(() => expect(searchResultChannelListener).toHaveBeenCalled(), {
        timeout: 8000,
      });

      expect(searchResultChannelListener).toHaveBeenCalledWith({
        id: data.searchQuery,
        error: null,
        payload: {
          files: [
            {
              exportedComponents: [
                {
                  default: false,
                  name: 'p',
                },
                {
                  default: false,
                  name: 'q',
                },
                {
                  default: false,
                  name: 'C',
                },
                {
                  default: false,
                  name: 'externalName',
                },
                {
                  default: false,
                  name: 'ns',
                },
                {
                  default: true,
                  name: 'default',
                },
              ],
              filepath: 'src/es-module.js',
              storyFileExists: true,
            },
          ],
        },
        success: true,
      });
    });

    it(
      'should emit search result event with an empty search result',
      { timeout: 10000 },
      async () => {
        const mockOptions = {};
        const data = { searchQuery: 'no-file-for-search-query' };

        await initFileSearchChannel(mockChannel, mockOptions as any);

        mockChannel.addListener(FILE_COMPONENT_SEARCH_RESPONSE, searchResultChannelListener);
        mockChannel.emit(FILE_COMPONENT_SEARCH_REQUEST, {
          id: data.searchQuery,
          payload: {},
        } satisfies RequestData<FileComponentSearchRequestPayload>);

        await vi.waitFor(
          () => {
            expect(searchResultChannelListener).toHaveBeenCalled();
          },
          {
            timeout: 8000,
          }
        );

        expect(searchResultChannelListener).toHaveBeenCalledWith({
          id: data.searchQuery,
          error: null,
          payload: {
            files: [],
          },
          success: true,
        });
      }
    );

    it('should emit a generic error message and log the original error if searching fails', async () => {
      const channel = new Channel({ transport });
      const listener = vi.fn();
      const searchError = new Error('Path /etc/passwd is not in cwd /path/to/project');
      vi.mocked(searchFiles).mockRejectedValueOnce(searchError);
      await initFileSearchChannel(channel, {} as any);

      channel.addListener(FILE_COMPONENT_SEARCH_RESPONSE, listener);
      channel.emit(FILE_COMPONENT_SEARCH_REQUEST, {
        id: 'commonjs',
        payload: {},
      } satisfies RequestData<FileComponentSearchRequestPayload>);

      await vi.waitFor(() => expect(listener).toHaveBeenCalled());

      expect(listener).toHaveBeenCalledWith({
        id: 'commonjs',
        error: 'An error occurred while searching for components in the project.',
        success: false,
      });
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining(searchError.message));
    });

    it('should emit an invalid search query error for a query outside of the project root', async () => {
      const channel = new Channel({ transport });
      const listener = vi.fn();
      await initFileSearchChannel(channel, {} as any);

      channel.addListener(FILE_COMPONENT_SEARCH_RESPONSE, listener);
      channel.emit(FILE_COMPONENT_SEARCH_REQUEST, {
        id: '/etc/*',
        payload: {},
      } satisfies RequestData<FileComponentSearchRequestPayload>);

      await vi.waitFor(() => expect(listener).toHaveBeenCalled());

      expect(listener).toHaveBeenCalledWith({
        id: '/etc/*',
        error: 'Invalid search query.',
        success: false,
      });
    });

    it.each(['Button', 'packages/ui/src/*'])(
      'should find %s in another workspace when Storybook runs from a monorepo package',
      async (searchQuery) => {
        const monorepoRoot = join(__dirname, '..', 'utils', '__search-files-monorepo__');
        vi.spyOn(common, 'getProjectRoot').mockReturnValue(monorepoRoot);
        vi.spyOn(process, 'cwd').mockReturnValue(join(monorepoRoot, 'apps', 'storybook'));
        const channel = new Channel({ transport });
        const listener = vi.fn();
        await initFileSearchChannel(channel, {} as any);

        channel.addListener(FILE_COMPONENT_SEARCH_RESPONSE, listener);
        channel.emit(FILE_COMPONENT_SEARCH_REQUEST, {
          id: searchQuery,
          payload: {},
        } satisfies RequestData<FileComponentSearchRequestPayload>);

        await vi.waitFor(() => expect(listener).toHaveBeenCalled());

        expect(listener).toHaveBeenCalledWith({
          id: searchQuery,
          error: null,
          payload: {
            files: [
              {
                filepath: 'packages/ui/src/Button.tsx',
                exportedComponents: [{ default: false, name: 'Button' }],
                storyFileExists: false,
              },
            ],
          },
          success: true,
        });
      }
    );
  });
});
