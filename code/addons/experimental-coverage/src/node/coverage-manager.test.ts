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
import { VitestManager } from './vitest-manager';

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
  const handleRequestCoverageSpy = vi.spyOn(CoverageManager.prototype, 'handleRequestCoverage');

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
    handleRequestCoverageSpy.mockClear();
    coverageManager = new CoverageManager(channel);
  });

  describe('handleRequestCoverage', () => {
    it('should return early if componentPath is not provided', async () => {
      await coverageManager.handleRequestCoverage({
        importPath: 'some/import/path',
        componentPath: '',
        initialRequest: false,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      } as RequestCoverageEventPayload);

      expect(channelListener[RESULT_FILE_CONTENT]).not.toHaveBeenCalled();
    });

    it('should emit file content when it is the initial request', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: true,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      await coverageManager.handleRequestCoverage(payload);
      expect(channelListener[RESULT_FILE_CONTENT]).toHaveBeenCalledWith({
        content: 'file content',
      });
    });

    it('should emit file content if the component path has changed', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: false,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      channel.emit(REQUEST_COVERAGE_EVENT, payload as RequestCoverageEventPayload);

      await vi.waitFor(() =>
        expect(CoverageManager.prototype.handleRequestCoverage).toHaveBeenCalled()
      );

      expect(channelListener[RESULT_FILE_CONTENT]).not.toHaveBeenCalledWith({
        content: 'file content',
      });

      channel.emit(REQUEST_COVERAGE_EVENT, {
        ...payload,
        componentPath: 'some/other/path',
      } as RequestCoverageEventPayload);

      await vi.waitFor(() =>
        expect(CoverageManager.prototype.handleRequestCoverage).toHaveBeenCalled()
      );

      expect(channelListener[RESULT_FILE_CONTENT]).toHaveBeenCalledWith({
        content: 'file content',
      });
    });

    it('should reinitialize VitestManager when it is the initial request', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: true,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      coverageManager.setPreviousState();
      coverageManager.previousState!.coverageType = 'project-coverage';
      await coverageManager.handleRequestCoverage(payload);
      expect(VitestManager.prototype.initVitest).toHaveBeenCalledWith({
        absoluteComponentPath: 'some/component/path',
        componentPath: payload.componentPath,
        importPath: payload.importPath,
        mode: payload.mode,
      });
    });

    it('should reinitialize VitestManager when component path was changed', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: true,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      coverageManager.setPreviousState();
      coverageManager.previousState!.absoluteComponentPath = join(process.cwd(), 'some/other/path');
      await coverageManager.handleRequestCoverage(payload);
      expect(VitestManager.prototype.initVitest).toHaveBeenCalledWith({
        absoluteComponentPath: 'some/component/path',
        componentPath: payload.componentPath,
        importPath: payload.importPath,
        mode: payload.mode,
      });
    });

    it('should reinitialize VitestManager when coverageType was changed', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: false,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      coverageManager.setPreviousState();
      coverageManager.previousState!.coverageType = 'project-coverage';
      await coverageManager.handleRequestCoverage(payload);
      expect(VitestManager.prototype.initVitest).toHaveBeenCalledWith({
        absoluteComponentPath: 'some/component/path',
        componentPath: payload.componentPath,
        importPath: payload.importPath,
        mode: payload.mode,
      });
    });

    it('should run affected tests when coverage type is project-coverage and the component-path has changed', async () => {
      const payload: RequestCoverageEventPayload = {
        importPath: 'some/import/path',
        componentPath: 'some/component/path',
        initialRequest: false,
        mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'project-coverage' },
      };

      vi.mocked(readFile).mockResolvedValue('file content');

      channel.emit(REQUEST_COVERAGE_EVENT, payload as RequestCoverageEventPayload);

      await vi.waitFor(() =>
        expect(CoverageManager.prototype.handleRequestCoverage).toHaveBeenCalled()
      );

      expect(channelListener[RESULT_FILE_CONTENT]).not.toHaveBeenCalledWith({
        content: 'file content',
      });

      channel.emit(REQUEST_COVERAGE_EVENT, {
        ...payload,
        componentPath: 'some/other/path',
      } as RequestCoverageEventPayload);

      await vi.waitFor(() =>
        expect(CoverageManager.prototype.handleRequestCoverage).toHaveBeenCalled()
      );

      await coverageManager.handleRequestCoverage(payload);

      expect(VitestManager.prototype.runAffectedTests).toHaveBeenCalledWith('some/component/path');
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
