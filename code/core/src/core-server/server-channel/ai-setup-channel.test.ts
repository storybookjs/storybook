import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelTransport } from 'storybook/internal/channels';
import { Channel } from 'storybook/internal/channels';
import {
  AI_SETUP_ANALYTICS_REQUEST,
  AI_SETUP_ANALYTICS_RESPONSE,
} from 'storybook/internal/core-events';
import type { Options } from 'storybook/internal/types';

import { initAIAnalyticsChannel } from './ai-setup-channel.ts';

vi.mock('storybook/internal/telemetry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/telemetry')>();
  return {
    ...actual,
    getLastEvents: vi.fn(),
    getStorybookMetadata: vi.fn(),
    isStoryCreatedByAISetup: vi.fn(),
    telemetry: vi.fn(),
  };
});

vi.mock('../../shared/utils/ai-checklist-flags.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/utils/ai-checklist-flags.ts')>();
  return {
    ...actual,
    getAiSetupRunId: vi.fn(),
  };
});

vi.mock('../utils/ghost-stories/run-story-tests.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/ghost-stories/run-story-tests.ts')>();
  return {
    ...actual,
    runStoryTests: vi.fn(),
  };
});

vi.mock('../utils/wait-for-idle-vitest.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/wait-for-idle-vitest.ts')>();
  return {
    ...actual,
    waitForIdleVitest: vi.fn(),
  };
});

const mockTelemetry = await import('storybook/internal/telemetry');
const mockAiChecklistFlags = await import('../../shared/utils/ai-checklist-flags.ts');
const mockRunStoryTests = await import('../utils/ghost-stories/run-story-tests.ts');
const mockWaitForIdleVitest = await import('../utils/wait-for-idle-vitest.ts');

describe('initAIAnalyticsChannel', () => {
  const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
  const mockChannel = new Channel({ transport });
  const analyticsResponseListener = vi.fn();
  // to avoid noise in the test output
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    transport.setHandler.mockClear();
    transport.send.mockClear();
    analyticsResponseListener.mockClear();
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();

    mockChannel.removeAllListeners();

    vi.mocked(mockTelemetry.getLastEvents).mockReset();
    vi.mocked(mockTelemetry.getStorybookMetadata).mockReset();
    vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReset();
    vi.mocked(mockTelemetry.telemetry).mockReset();
    vi.mocked(mockAiChecklistFlags.getAiSetupRunId).mockReset().mockResolvedValue(undefined);
    vi.mocked(mockRunStoryTests.runStoryTests).mockReset();
    vi.mocked(mockWaitForIdleVitest.waitForIdleVitest).mockReset().mockResolvedValue(true);
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('no-op conditions', () => {
    it('should skip scoring when there is no lastAISetup event', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        init: { body: { sessionId: 'test-session' } },
      } as any);

      initAIAnalyticsChannel(mockChannel, {} as Options);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
      expect(mockTelemetry.getStorybookMetadata).not.toHaveBeenCalled();
    });

    it('should skip scoring when lastSetupStoryScoringRun.runId matches lastAISetup.runId (same session)', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
        'ai-setup-final-scoring': { body: { payload: { runId: 'session-A' } } },
      } as any);

      initAIAnalyticsChannel(mockChannel, {} as Options);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
      expect(mockTelemetry.getStorybookMetadata).not.toHaveBeenCalled();
    });
  });

  describe('run conditions', () => {
    it('should run scoring when there is no lastSetupStoryScoringRun (first time)', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);
      vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReturnValue(false);

      const mockGenerator = {
        getIndexAndStats: vi.fn().mockResolvedValue({
          storyIndex: { entries: {} },
        }),
      };

      initAIAnalyticsChannel(mockChannel, {} as Options, () =>
        Promise.resolve(mockGenerator as any)
      );
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          stats: expect.objectContaining({ fileCount: 0, storyCount: 0 }),
        })
      );
    });

    it('should run scoring when lastSetupStoryScoringRun.runId differs from lastAISetup.runId (new ai-setup session)', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-B' } } },
        'ai-setup-final-scoring': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);
      vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReturnValue(false);

      const mockGenerator = {
        getIndexAndStats: vi.fn().mockResolvedValue({
          storyIndex: { entries: {} },
        }),
      };

      initAIAnalyticsChannel(mockChannel, {} as Options, () =>
        Promise.resolve(mockGenerator as any)
      );
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          stats: expect.objectContaining({ fileCount: 0, storyCount: 0 }),
        })
      );
    });

    it('should run scoring for AI-generated story files when they are found', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-B' } } },
        'ai-setup-final-scoring': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);
      vi.mocked(mockTelemetry.isStoryCreatedByAISetup).mockReturnValue(true);
      vi.mocked(mockRunStoryTests.runStoryTests).mockResolvedValue({
        duration: 1234,
        summary: {
          runTotal: 2,
          runPassed: 2,
          runSuccessRate: 1,
          runSuccessRateWithoutEmptyRender: 1,
          runCategorizedErrors: {},
          runCssCheck: 'not-run',
          runUniqueErrorCount: 0,
          runPassedButEmptyRender: 0,
        },
      } as any);
      vi.mocked(mockAiChecklistFlags.getAiSetupRunId).mockResolvedValue('session-B');

      const mockGenerator = {
        getIndexAndStats: vi.fn().mockResolvedValue({
          storyIndex: {
            entries: {
              'story-1': { importPath: './Button.stories.tsx', type: 'story' },
            },
          },
        }),
      };

      initAIAnalyticsChannel(mockChannel, {} as Options, () =>
        Promise.resolve(mockGenerator as any)
      );
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockRunStoryTests.runStoryTests).toHaveBeenCalledWith(['./Button.stories.tsx']);
      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          stats: expect.objectContaining({
            fileCount: 1,
            storyCount: 1,
            testRunDuration: 1234,
            runId: 'session-B',
          }),
          results: expect.objectContaining({ runTotal: 2, runPassed: 2 }),
        })
      );
    });
  });

  describe('gating conditions', () => {
    it('should skip scoring when renderer is not React', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/vue',
        addons: { '@storybook/addon-vitest': {} },
      } as any);

      initAIAnalyticsChannel(mockChannel, {} as Options);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
    });

    it('should skip scoring when vitest addon is not present', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: {},
      } as any);

      initAIAnalyticsChannel(mockChannel, {} as Options);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.getStorybookMetadata).toHaveBeenCalled();
      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
    });

    it('should skip scoring when vitest is not idle', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockResolvedValue({
        'ai-setup': { body: { payload: { runId: 'session-A' } } },
      } as any);
      vi.mocked(mockTelemetry.getStorybookMetadata).mockResolvedValue({
        renderer: '@storybook/react',
        addons: { '@storybook/addon-vitest': {} },
      } as any);
      vi.mocked(mockWaitForIdleVitest.waitForIdleVitest).mockResolvedValue(false);

      initAIAnalyticsChannel(mockChannel, {} as Options);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockRunStoryTests.runStoryTests).not.toHaveBeenCalled();
      expect(mockTelemetry.telemetry).not.toHaveBeenCalled();
    });
  });

  describe('error conditions', () => {
    it('should call telemetry with runError when an unexpected error occurs', async () => {
      mockChannel.addListener(AI_SETUP_ANALYTICS_RESPONSE, analyticsResponseListener);

      vi.mocked(mockTelemetry.getLastEvents).mockRejectedValue(new Error('Cache error'));

      initAIAnalyticsChannel(mockChannel, {} as Options);
      mockChannel.emit(AI_SETUP_ANALYTICS_REQUEST);

      await vi.waitFor(() => {
        expect(analyticsResponseListener).toHaveBeenCalled();
      });

      expect(mockTelemetry.telemetry).toHaveBeenCalledWith(
        'ai-setup-final-scoring',
        expect.objectContaining({
          runError: 'Unknown error during AI story scoring',
        })
      );
    });
  });
});
