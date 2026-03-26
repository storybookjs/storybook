import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
    getLastEvents: vi.fn(),
    getSessionId: vi.fn(),
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
    vi.mocked(mockTelemetry.getLastEvents).mockReset();
    vi.mocked(mockTelemetry.getSessionId).mockReset();
    vi.mocked(mockTelemetry.getStorybookMetadata).mockReset();
    vi.mocked(mockTelemetry.telemetry).mockReset();
    vi.mocked(mockStoryGeneration.getComponentCandidates).mockReset();
    mockFs.existsSync.mockReset();
    mockFs.mkdir.mockReset();
    mockFs.readFile.mockReset();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('initGhostStoriesChannel', { retry: 3 }, () => {
    it('should execute successful discovery run', async () => {
      mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
      // Has not run yet (no ghost stories event and session matches)
      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        init: { body: { sessionId: 'test-session' } },
      } as any);
      vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');

      // Has React + Vitest
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);

      // Has valid candidates for story files
      vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
        candidates: ['component1.tsx', 'component2.tsx'],
        globMatchCount: 10,
        analyzedCount: 5,
        avgComplexity: 2.5,
      });

      // Has ran tests successfully and written reports to JSON file in cache directory
      vi.mocked(mockCommon.resolvePathInStorybookCache).mockReturnValue(
        '/cache/ghost-stories-tests'
      );
      vi.mocked(mockCommon.executeCommand).mockResolvedValue({} as any);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
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
        stats: {
          globMatchCount: 10,
          candidateAnalysisDuration: expect.any(Number),
          totalRunDuration: expect.any(Number),
          analyzedCount: 5,
          avgComplexity: 2.5,
          candidateCount: 2,
          testRunDuration: expect.any(Number),
        },
        results: {
          total: 2,
          passed: 2,
          successRate: 1,
          successRateWithoutEmptyRender: 1,
          categorizedErrors: expect.any(Object),
          uniqueErrorCount: 0,
          passedButEmptyRender: 0,
        },
      });
    });

    it('should execute successful discovery run with test failure', async () => {
      mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
      // Has not run yet (no ghost stories event and session matches)
      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        init: { body: { sessionId: 'test-session' } },
      } as any);
      vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');

      // Has React + Vitest
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);

      // Has valid candidates for story files
      vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
        candidates: ['component1.tsx', 'component2.tsx'],
        globMatchCount: 10,
      });

      // Has ran tests but with failures, reports written to JSON file in cache directory
      vi.mocked(mockCommon.resolvePathInStorybookCache).mockReturnValue(
        '/cache/ghost-stories-tests'
      );
      vi.mocked(mockCommon.executeCommand).mockResolvedValue({} as any);
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFile.mockResolvedValue(
        JSON.stringify({
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
          stats: {
            globMatchCount: 10,
            candidateAnalysisDuration: expect.any(Number),
            totalRunDuration: expect.any(Number),
            analyzedCount: expect.any(Number),
            avgComplexity: expect.any(Number),
            candidateCount: 2,
            testRunDuration: expect.any(Number),
          },
          results: expect.objectContaining({
            total: 2,
            passed: 0,
            successRate: 0,
            // categorizedErrors is now an object with categories as keys
            categorizedErrors: expect.any(Object),
            uniqueErrorCount: expect.any(Number),
            passedButEmptyRender: 0,
          }),
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
        // Has already run (ghost stories event exists)
        vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
          'ghost-stories': { timestamp: Date.now(), body: {} },
          init: { body: { sessionId: 'test-session' } },
        } as any);
        vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockTelemetry.getLastEvents).toHaveBeenCalled();
        expect(mockTelemetry.getSessionId).toHaveBeenCalled();
        expect(mockTelemetry.getStorybookMetadata).not.toHaveBeenCalled();
        expect(mockStoryGeneration.getComponentCandidates).not.toHaveBeenCalled();
      });

      it('should skip discovery run when not in a React + Vitest project', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        // Has not run yet (no ghost stories event and session matches)
        vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
          init: { body: { sessionId: 'test-session' } },
        } as any);
        vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/vue',
          addons: { '@storybook/addon-vitest': {} },
        } as any);

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockTelemetry.getLastEvents).toHaveBeenCalled();
        expect(mockTelemetry.getSessionId).toHaveBeenCalled();
        expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
        expect(mockStoryGeneration.getComponentCandidates).not.toHaveBeenCalled();
      });

      it('should skip discovery run when vitest addon not present', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        // Has not run yet (no ghost stories event and session matches)
        vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
          init: { body: { sessionId: 'test-session' } },
        } as any);
        vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: {},
        } as any);

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockTelemetry.getLastEvents).toHaveBeenCalled();
        expect(mockTelemetry.getSessionId).toHaveBeenCalled();
        expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
        expect(mockStoryGeneration.getComponentCandidates).not.toHaveBeenCalled();
      });
    });

    describe('error conditions', () => {
      it('should handle error in getComponentCandidates', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        // Has not run yet (no ghost stories event and session matches)
        vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
          init: { body: { sessionId: 'test-session' } },
        } as any);
        vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: [],
          error: 'Failed to analyze components',
          globMatchCount: 0,
        });

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockStoryGeneration.getComponentCandidates).toHaveBeenCalled();
        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          runError: 'Failed to analyze components',
          stats: {
            globMatchCount: 0,
            candidateAnalysisDuration: expect.any(Number),
            totalRunDuration: expect.any(Number),
            analyzedCount: 0,
            avgComplexity: 0,
            candidateCount: 0,
          },
        });
      });

      it('should handle no candidates found', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        // Has not run yet (no ghost stories event and session matches)
        vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
          init: { body: { sessionId: 'test-session' } },
        } as any);
        vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: [],
          globMatchCount: 5,
          analyzedCount: 3,
          avgComplexity: 1.5,
        });

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockStoryGeneration.getComponentCandidates).toHaveBeenCalled();
        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          runError: 'No candidates found',
          stats: {
            globMatchCount: 5,
            candidateAnalysisDuration: expect.any(Number),
            totalRunDuration: expect.any(Number),
            analyzedCount: 3,
            avgComplexity: 1.5,
            candidateCount: 0,
          },
        });
      });

      it('should handle JSON report not found', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        // Has not run yet (no ghost stories event and session matches)
        vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
          init: { body: { sessionId: 'test-session' } },
        } as any);
        vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: ['component1.tsx'],
          globMatchCount: 5,
          analyzedCount: 2,
          avgComplexity: 1.0,
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
          runError: 'JSON report not found',
          stats: {
            globMatchCount: 5,
            candidateAnalysisDuration: expect.any(Number),
            totalRunDuration: expect.any(Number),
            analyzedCount: 2,
            avgComplexity: 1.0,
            candidateCount: 1,
            testRunDuration: expect.any(Number),
          },
        });
      });

      it('should handle test startup error', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        // Has not run yet (no ghost stories event and session matches)
        vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
          init: { body: { sessionId: 'test-session' } },
        } as any);
        vi.mocked(mockTelemetry.getSessionId).mockResolvedValue('test-session');
        vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
          renderer: '@storybook/react',
          addons: { '@storybook/addon-vitest': {} },
        } as any);
        vi.mocked(mockStoryGeneration.getComponentCandidates).mockResolvedValue({
          candidates: ['component1.tsx'],
          globMatchCount: 5,
          analyzedCount: 2,
          avgComplexity: 1.0,
        });
        vi.mocked(mockCommon.resolvePathInStorybookCache).mockReturnValue(
          '/cache/ghost-stories-tests'
        );
        vi.mocked(mockCommon.executeCommand).mockRejectedValue(new Error('Startup Error'));
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFile.mockResolvedValue(
          JSON.stringify({
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
          runError: 'Startup Error',
          stats: {
            globMatchCount: 5,
            candidateAnalysisDuration: expect.any(Number),
            totalRunDuration: expect.any(Number),
            analyzedCount: 2,
            avgComplexity: 1.0,
            candidateCount: 1,
            testRunDuration: expect.any(Number),
          },
        });
      });

      it('should handle general error during execution', async () => {
        mockChannel.addListener(GHOST_STORIES_RESPONSE, ghostStoriesEventListener);
        vi.mocked(mockTelemetry.getLastEvents).mockRejectedValue(new Error('Cache error') as any);

        initGhostStoriesChannel(mockChannel, {} as Options, { disableTelemetry: false });

        mockChannel.emit(GHOST_STORIES_REQUEST);

        await vi.waitFor(() => {
          expect(ghostStoriesEventListener).toHaveBeenCalled();
        });

        expect(mockTelemetry.telemetry).toHaveBeenCalledWith('ghost-stories', {
          runError: 'Unknown error during ghost run',
          stats: {},
        });
      });
    });
  });
});
