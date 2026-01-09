import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelTransport } from 'storybook/internal/channels';
import { Channel } from 'storybook/internal/channels';
import { GHOST_STORIES_REQUEST, GHOST_STORIES_RESPONSE } from 'storybook/internal/core-events';
import type { Options } from 'storybook/internal/types';

import { initGhostStoriesChannel } from './ghost-stories-channel';

vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    cache: {
      get: vi.fn(),
      set: vi.fn(),
    },
    executeCommand: vi.fn(),
    resolvePathInStorybookCache: vi.fn(),
  };
});

vi.mock('storybook/internal/telemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/telemetry')>();
  return {
    ...actual,
    getStorybookMetadata: vi.fn(),
    telemetry: vi.fn(),
  };
});

vi.mock('../utils/ghost-stories/get-candidates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/ghost-stories/get-candidates')>();
  return {
    ...actual,
    getComponentCandidates: vi.fn(),
  };
});

const mockFs = vi.hoisted(() => {
  return {
    existsSync: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockFs.existsSync,
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    mkdir: mockFs.mkdir,
    readFile: mockFs.readFile,
  };
});

const mockCommon = await import('storybook/internal/common');
const mockTelemetry = await import('storybook/internal/telemetry');
const mockStoryGeneration = await import('../utils/ghost-stories/get-candidates');

describe('ghostStoriesChannel', () => {
  const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
  const mockChannel = new Channel({ transport });
  const ghostStoriesEventListener = vi.fn();
  // to avoid noise in the test output
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    transport.setHandler.mockClear();
    transport.send.mockClear();
    ghostStoriesEventListener.mockClear();
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();

    // Reset channel listeners
    mockChannel.removeAllListeners();

    // Reset all mocks
    vi.mocked(mockCommon.cache.get).mockReset();
    vi.mocked(mockCommon.cache.set).mockReset();
    vi.mocked(mockCommon.executeCommand).mockReset();
    vi.mocked(mockCommon.resolvePathInStorybookCache).mockReset();
    vi.mocked(mockTelemetry.getStorybookMetadata).mockReset();
    vi.mocked(mockTelemetry.telemetry).mockReset();
    vi.mocked(mockStoryGeneration.getComponentCandidates).mockReset();
    mockFs.existsSync.mockReset();
    mockFs.mkdir.mockReset();
    mockFs.readFile.mockReset();
  });

  describe('initGhostStoriesChannel', { retry: 3 }, () => {
    it('should execute successful discovery run', async () => {
      mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
      // Has not run yet
      vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
      vi.mocked(mockCommon.cache.set).mockResolvedValue();

      // Has React + Vitest
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);

      // Has valid candidates for story files
      vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
        candidates: ['component1.tsx', 'component2.tsx'],
        matchCount: 10,
      });

      // Has ran tests successfully and written reports to JSON file in cache directory
      vi.mocked(mockCommon.resolvePathInStorybookCache).mockReturnValue(
        '/cache/ghost-stories-tests'
      );
      vi.mocked(mockCommon.executeCommand).mockResolvedValue({} as any);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          success: true,
          numTotalTests: 2,
          numPassedTests: 2,
          numFailedTests: 0,
          testResults: [
            {
              assertionResults: [
                {
                  meta: { storyId: 'component1--default' },
                  status: 'passed',
                },
                {
                  meta: { storyId: 'component2--default' },
                  status: 'passed',
                },
              ],
            },
          ],
        })
      );

      initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

      mockChannel.emit(GHOST_STORIES_REQUEST);

      await vi.waitFor(() => {
        expect(ghostStoriesEventListener).toHaveBeenCalled();
      });

      // Vitest command is executed with the correct arguments
      expect(mockCommon.executeCommand).toHaveBeenCalledWith({
        command: 'npx',
        args: [
          'vitest',
          'run',
          '--reporter=json',
          '--testTimeout=1000',
          expect.stringContaining('--outputFile=/cache/ghost-stories-tests/test-results-'),
          'component1.tsx',
          'component2.tsx',
        ],
        stdio: 'pipe',
        env: {
          STORYBOOK_COMPONENT_PATHS: 'component1.tsx;component2.tsx',
        },
      } as any);

      // Telemetry is called with the correct data
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
        success: true,
        generatedCount: 2,
        testDuration: expect.any(Number),
        analysisDuration: 0,
        testSummary: {
          total: 2,
          passed: 2,
          failed: 0,
          failureRate: 0,
          successRate: 1,
          successRateWithoutEmptyRender: 1,
          categorizedErrors: [],
          uniqueErrorCount: 0,
          passedButEmptyRender: 0,
        },
        matchCount: 10,
      });
    });

    it('should execute successful discovery run with test failure', async () => {
      mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
      // Has not run yet
      vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
      vi.mocked(mockCommon.cache.set).mockResolvedValue();

      // Has React + Vitest
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);

      // Has valid candidates for story files
      vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
        candidates: ['component1.tsx', 'component2.tsx'],
        matchCount: 10,
      });

      // Has ran tests but with failures, reports written to JSON file in cache directory
      vi.mocked(mockCommon.resolvePathInStorybookCache).mockReturnValue(
        '/cache/ghost-stories-tests'
      );
      vi.mocked(mockCommon.executeCommand).mockResolvedValue({} as any);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
          success: false,
          numTotalTests: 2,
          numPassedTests: 0,
          numFailedTests: 2,
          testResults: [
            {
              assertionResults: [
                {
                  meta: { storyId: 'component1--default' },
                  status: 'failed',
                  failureMessages: ['Error: Expected button to be disabled'],
                },
                {
                  meta: { storyId: 'component2--default' },
                  status: 'failed',
                  failureMessages: ['TypeError: Cannot read properties of undefined'],
                },
              ],
            },
          ],
        })
      );

      initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

      mockChannel.emit(GHOST_STORIES_REQUEST);

      await vi.waitFor(() => {
        expect(ghostStoriesEventListener).toHaveBeenCalled();
      });

      // Vitest command is executed with the correct arguments
      expect(mockCommon.executeCommand).toHaveBeenCalledWith({
        command: 'npx',
        args: [
          'vitest',
          'run',
          '--reporter=json',
          '--testTimeout=1000',
          expect.stringContaining('--outputFile=/cache/ghost-stories-tests/test-results-'),
          'component1.tsx',
          'component2.tsx',
        ],
        stdio: 'pipe',
        env: {
          STORYBOOK_COMPONENT_PATHS: 'component1.tsx;component2.tsx',
        },
      } as any);

      // Telemetry is called with the correct data
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ghost-stories',
        expect.objectContaining({
          success: false,
          generatedCount: 2,
          testDuration: expect.any(Number),
          analysisDuration: expect.any(Number),
          testSummary: expect.objectContaining({
            total: 2,
            passed: 0,
            failed: 2,
            failureRate: 1,
            successRate: 0,
            // There should be two unique errors: one for component1, one for component2
            categorizedErrors: expect.arrayContaining([
              expect.objectContaining({
                category: expect.any(String),
                examples: expect.arrayContaining([
                  expect.stringContaining('TypeError: Cannot read properties of undefined'),
                ]),
              }),
              expect.objectContaining({
                category: expect.any(String),
                examples: expect.arrayContaining([
                  expect.stringContaining('Expected button to be disabled'),
                ]),
              }),
            ]),
            uniqueErrorCount: expect.any(Number),
            passedButEmptyRender: 0,
          }),
          matchCount: 10,
        })
      );
    });

    describe('no-op conditions', () => {
      it('should skip discovery run when telemetry is disabled', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: true });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        // When telemetry is disabled, no listener is set up, so wait a bit and check nothing happened
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(ghostStoriesEventListener).not.toHaveBeenCalled();
        expect(mockCommon.cache.get).not.toHaveBeenCalled();
        expect(mockTelemetry.getStorybookMetadata).not.toHaveBeenCalled();
        expect(mockStoryGeneration.getComponentCandidates).not.toHaveBeenCalled();
      });

      it('should skip discovery run when already ran', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockResolvedValue({ timestamp: Date.now() });

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockCommon.cache.get).toHaveBeenCalledWith('experimental/ghost-stories/has-run');
        expect(mockTelemetry.getStorybookMetadata).not.toHaveBeenCalled();
        expect(mockStoryGeneration.getComponentCandidates).not.toHaveBeenCalled();
      });

      it('should skip discovery run when not in a React + Vitest project', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/vue',
          addons: { '@storybook/addon-vitest': {} },
        } as any);

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockCommon.cache.get).toHaveBeenCalledWith('experimental/ghost-stories/has-run');
        expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
        expect(mockStoryGeneration.getComponentCandidates).not.toHaveBeenCalled();
      });

      it('should skip discovery run when vitest addon not present', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: {},
        } as any);

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockCommon.cache.get).toHaveBeenCalledWith('experimental/ghost-stories/has-run');
        expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
        expect(mockStoryGeneration.getComponentCandidates).not.toHaveBeenCalled();
      });
    });

    describe('error conditions', () => {
      it('should handle error in getComponentCandidates', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
        vi.mocked(mockCommon.cache.set).mockResolvedValue();
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: [],
          error: 'Failed to analyze components',
          matchCount: 0,
        });

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockCommon.cache.set).toHaveBeenCalledWith('experimental/ghost-stories/has-run', {
          timestamp: expect.any(Number),
        });
        expect(mockStoryGeneration.getComponentCandidates).toHaveBeenCalled();
        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          success: false,
          error: 'Failed to analyze components',
          matchCount: 0,
          analysisDuration: expect.any(Number),
        });
      });

      it('should handle no candidates found', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
        vi.mocked(mockCommon.cache.set).mockResolvedValue();
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: [],
          matchCount: 5,
        });

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockStoryGeneration.getComponentCandidates).toHaveBeenCalled();
        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          success: false,
          error: 'No candidates found',
          matchCount: 5,
          analysisDuration: expect.any(Number),
        });
      });

      it('should handle JSON report not found', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
        vi.mocked(mockCommon.cache.set).mockResolvedValue();
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: ['component1.tsx'],
          matchCount: 5,
        });
        vi.mocked(mockCommon.resolvePathInStorybookCache).mockReturnValue(
          '/cache/ghost-stories-tests'
        );
        vi.mocked(mockCommon.executeCommand).mockRejectedValue(new Error('Test execution failed'));
        mockFs.existsSync.mockReturnValue(false);

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          success: false,
          generatedCount: 1,
          testDuration: expect.any(Number),
          analysisDuration: expect.any(Number),
          matchCount: 5,
          error: 'JSON report not found',
          testSummary: undefined,
        });
      });

      it('should handle test startup error', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockResolvedValue(null);
        vi.mocked(mockCommon.cache.set).mockResolvedValue();
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: ['component1.tsx'],
          matchCount: 5,
        });
        vi.mocked(mockCommon.resolvePathInStorybookCache).mockReturnValue(
          '/cache/ghost-stories-tests'
        );
        vi.mocked(mockCommon.executeCommand).mockRejectedValue(new Error('Startup Error'));
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
            success: false,
            numTotalTests: 2,
            numPassedTests: 0,
            numFailedTests: 2,
            testResults: [],
          })
        );

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          success: false,
          generatedCount: 1,
          testDuration: expect.any(Number),
          analysisDuration: expect.any(Number),
          matchCount: 5,
          error: 'Startup Error',
          testSummary: undefined,
        });
      });

      it('should handle general error during execution', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockCommon.cache.get).mockRejectedValue(new Error('Cache error'));

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          success: false,
          error: 'Cache error',
          matchCount: 0,
        });
      });
    });
  });
});
