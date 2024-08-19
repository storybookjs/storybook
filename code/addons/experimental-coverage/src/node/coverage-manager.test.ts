import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Channel } from 'storybook/internal/channels';

import {
  REQUEST_COVERAGE_EVENT,
  RESULT_FILE_CONTENT,
  type RequestCoverageEventPayload,
} from '../constants';
import { CoverageManager } from './coverage-manager';

vi.mock('node:fs/promises');
vi.mock('node:path', () => ({
  join: vi.fn((path1, path2) => path2),
}));
vi.mock('./vitest-manager');
vi.mock('./coverage-emitter');

describe('CoverageManager', () => {
  let channel: Channel;
  let channelListener: Record<string, (options: any) => any> = {};
  let coverageManager: CoverageManager;

  beforeEach(() => {
    channelListener = {
      [RESULT_FILE_CONTENT]: vi.fn(),
    };
    channel = {
      on: vi.fn((event, listener) => {
        channelListener[event] = listener;
      }),
      emit: vi.fn((event, options) => {
        channelListener[event](options);
      }),
    } as unknown as Channel;
    coverageManager = new CoverageManager(channel);
  });

  describe('handleRequestCoverage', () => {
    it('should handle request coverage with valid componentPath', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: false,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      await coverageManager.handleRequestCoverage(payload);

      expect(join).toHaveBeenCalledWith(process.cwd(), payload.componentPath);
      expect(readFile).toHaveBeenCalledWith('some/component/path', 'utf8');
      expect(channel.emit).toHaveBeenCalledWith(RESULT_FILE_CONTENT, { content: 'file content' });
    });

    it('should handle request coverage with initialRequest', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: true,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      await coverageManager.handleRequestCoverage(payload);

      expect(join).toHaveBeenCalledWith(process.cwd(), payload.componentPath);
      expect(readFile).toHaveBeenCalledWith('some/component/path', 'utf8');
      expect(channel.emit).toHaveBeenCalledWith(RESULT_FILE_CONTENT, { content: 'file content' });
    });
  });

  describe('emitFileContent', () => {
    it('should emit file content with valid absoluteComponentPath', async () => {
      const absoluteComponentPath = 'absolute/component/path';
      vi.mocked(readFile).mockResolvedValue('file content');

      await coverageManager.emitFileContent(absoluteComponentPath);

      expect(readFile).toHaveBeenCalledWith(absoluteComponentPath, 'utf8');
      expect(channel.emit).toHaveBeenCalledWith(RESULT_FILE_CONTENT, { content: 'file content' });
    });
  });

  describe('getFilesWithCoverageInformation', () => {
    it('should return array with absoluteComponentPath', async () => {
      channel.emit(REQUEST_COVERAGE_EVENT, {
        componentPath: 'some/component/path',
        importPath: 'some/import/path',
        initialRequest: false,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      } as RequestCoverageEventPayload);

      expect(coverageManager.getFilesWithCoverageInformation()).toEqual(['some/component/path']);
    });
  });
});
