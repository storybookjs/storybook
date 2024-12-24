import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelTransport } from '@storybook/core/channels';
import { Channel } from '@storybook/core/channels';

import type { CreateNewStoryRequestPayload, RequestData } from '@storybook/core/core-events';
import {
  CREATE_NEW_STORYFILE_REQUEST,
  CREATE_NEW_STORYFILE_RESPONSE,
} from '@storybook/core/core-events';

import { initCreateNewStoryChannel } from './create-new-story-channel';

vi.mock('@storybook/core/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@storybook/core/common')>();
  return {
    ...actual,
    getProjectRoot: vi.fn().mockReturnValue(process.cwd()),
  };
});

const mockFs = vi.hoisted(() => {
  return {
    writeFile: vi.fn(),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    writeFile: mockFs.writeFile,
  };
});

describe(
  'createNewStoryChannel',
  () => {
    const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
    const mockChannel = new Channel({ transport });
    const createNewStoryFileEventListener = vi.fn();

    beforeEach(() => {
      transport.setHandler.mockClear();
      transport.send.mockClear();
      createNewStoryFileEventListener.mockClear();
    });

    describe('initCreateNewStoryChannel', () => {
      it('should emit an event with a story id', async () => {
        mockChannel.addListener(CREATE_NEW_STORYFILE_RESPONSE, createNewStoryFileEventListener);
        const cwd = process.cwd();

        initCreateNewStoryChannel(
          mockChannel,
          {
            configDir: join(cwd, '.storybook'),
            presets: {
              apply: (val: string) => {
                if (val === 'framework') {
                  return Promise.resolve('@storybook/nextjs');
                }
                if (val === 'stories') {
                  return Promise.resolve(['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)']);
                }
              },
            },
          } as any,
          { disableTelemetry: true }
        );

        mockChannel.emit(CREATE_NEW_STORYFILE_REQUEST, {
          id: 'components-page--default',
          payload: {
            componentFilePath: 'src/components/Page.jsx',
            componentExportName: 'Page',
            componentIsDefaultExport: true,
          },
        });

        await vi.waitFor(() => {
          expect(createNewStoryFileEventListener).toHaveBeenCalled();
        });

        expect(createNewStoryFileEventListener).toHaveBeenCalledWith({
          error: null,
          id: 'components-page--default',
          payload: {
            storyId: 'components-page--default',
            storyFilePath: join('src', 'components', 'Page.stories.jsx'),
            exportedStoryName: 'Default',
          },
          success: true,
        });
      });

      it('should emit an error event if an error occurs', async () => {
        mockChannel.addListener(CREATE_NEW_STORYFILE_RESPONSE, createNewStoryFileEventListener);
        const cwd = process.cwd();

        mockFs.writeFile.mockImplementation(() => {
          throw new Error('Failed to write file');
        });

        initCreateNewStoryChannel(
          mockChannel,
          {
            configDir: join(cwd, '.storybook'),
            presets: {
              apply: (val: string) => {
                if (val === 'framework') {
                  return Promise.resolve('@storybook/nextjs');
                }
                if (val === 'stories') {
                  return Promise.resolve(['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)']);
                }
              },
            },
          } as any,
          { disableTelemetry: true }
        );

        mockChannel.emit(CREATE_NEW_STORYFILE_REQUEST, {
          id: 'components-page--default',
          payload: {
            componentFilePath: 'src/components/Page.jsx',
            componentExportName: 'Page',
            componentIsDefaultExport: true,
            componentExportCount: 1,
          },
        } satisfies RequestData<CreateNewStoryRequestPayload>);

        await vi.waitFor(() => {
          expect(createNewStoryFileEventListener).toHaveBeenCalled();
        });

        expect(createNewStoryFileEventListener).toHaveBeenCalledWith({
          error: 'Failed to write file',
          id: 'components-page--default',
          success: false,
        });
      });
    });
  },
  { retry: 3 }
);
