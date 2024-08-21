// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelTransport } from '@storybook/core/channels';
import { Channel } from '@storybook/core/channels';
import {
  extractProperRendererNameFromFramework,
  getFrameworkName,
  getProjectRoot,
} from '@storybook/core/common';

import type { FileComponentSearchRequestPayload, RequestData } from '@storybook/core/core-events';
import {
  FILE_COMPONENT_SEARCH_REQUEST,
  FILE_COMPONENT_SEARCH_RESPONSE,
} from '@storybook/core/core-events';

import { searchFiles } from '../utils/search-files';
import { initFileSearchChannel } from './file-search-channel';

vi.mock(import('../utils/search-files'), async (importOriginal) => ({
  searchFiles: vi.fn((await importOriginal()).searchFiles),
}));

vi.mock('@storybook/core/common');

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getFrameworkName).mockResolvedValue('@storybook/react');
  vi.mocked(extractProperRendererNameFromFramework).mockResolvedValue('react');
  vi.mocked(getProjectRoot).mockReturnValue(
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

      await initFileSearchChannel(mockChannel, mockOptions as any, { disableTelemetry: true });

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

        await initFileSearchChannel(mockChannel, mockOptions as any, { disableTelemetry: true });

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

    it('should emit an error message if an error occurs while searching for components in the project', async () => {
      const mockOptions = {} as any;
      const data = { searchQuery: 'commonjs' };
      await initFileSearchChannel(mockChannel, mockOptions, { disableTelemetry: true });

      mockChannel.addListener(FILE_COMPONENT_SEARCH_RESPONSE, searchResultChannelListener);

      mockChannel.emit(FILE_COMPONENT_SEARCH_REQUEST, {
        id: data.searchQuery,
        payload: {},
      });

      vi.mocked(searchFiles).mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await vi.waitFor(() => expect(searchResultChannelListener).toHaveBeenCalled());

      expect(searchResultChannelListener).toHaveBeenCalledWith({
        id: data.searchQuery,
        error:
          'An error occurred while searching for components in the project.\nENOENT: no such file or directory',
        success: false,
      });
    });
  });
});
