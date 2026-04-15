import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentTelemetryReporter } from './agent-telemetry-reporter.ts';

vi.mock('storybook/internal/telemetry', () => ({
  telemetry: vi.fn(),
  isExampleStoryId: vi.fn(
    (id: string) =>
      id.startsWith('example-button--') ||
      id.startsWith('example-header--') ||
      id.startsWith('example-page--')
  ),
}));

const { telemetry } = await import('storybook/internal/telemetry');

function createMockTestCase({
  storyId,
  status,
  reports = [],
  errors = [],
}: {
  storyId?: string;
  status: 'passed' | 'failed' | 'pending';
  reports?: Array<{ type: string; result?: Record<string, unknown> }>;
  errors?: Array<{ message: string; stack?: string }>;
}) {
  return {
    meta: () => ({ storyId, reports }),
    result: () => ({
      state: status,
      errors: status === 'failed' ? errors : [],
    }),
  };
}

function createMockTestModules(testCounts: { passed: number; failed: number }) {
  const tests: Array<{ result: () => { state: string } }> = [];
  for (let i = 0; i < testCounts.passed; i++) {
    tests.push({ result: () => ({ state: 'passed' }) });
  }
  for (let i = 0; i < testCounts.failed; i++) {
    tests.push({ result: () => ({ state: 'failed' }) });
  }
  return [
    {
      children: {
        allTests: function* (filter?: string) {
          for (const t of tests) {
            if (!filter || t.result().state === filter) {
              yield t;
            }
          }
        },
      },
      errors: () => [],
    },
  ];
}

describe('AgentTelemetryReporter', () => {
  let reporter: AgentTelemetryReporter;

  beforeEach(() => {
    vi.clearAllMocks();
    reporter = new AgentTelemetryReporter({
      configDir: '.storybook',
      agent: { name: 'claude' },
    });
  });

  describe('onTestCaseResult', () => {
    it('should collect story test results', () => {
      const testCase = createMockTestCase({
        storyId: 'my-story--primary',
        status: 'passed',
      });
      reporter.onTestCaseResult(testCase as any);
    });

    it('should skip tests without storyId', () => {
      const testCase = createMockTestCase({
        storyId: undefined,
        status: 'passed',
      });
      reporter.onTestCaseResult(testCase as any);
    });

    it('should skip example story IDs', () => {
      const testCase = createMockTestCase({
        storyId: 'example-button--primary',
        status: 'passed',
      });
      reporter.onTestCaseResult(testCase as any);
    });
  });

  describe('onTestRunEnd', () => {
    it('should send telemetry with analysis of collected results', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      reporter.onTestCaseResult(createMockTestCase({ storyId: 's1', status: 'passed' }) as any);
      reporter.onTestCaseResult(
        createMockTestCase({
          storyId: 's2',
          status: 'failed',
          errors: [{ message: 'Error: Module not found: foo' }],
        }) as any
      );
      reporter.onTestCaseResult(
        createMockTestCase({
          storyId: 's3',
          status: 'passed',
          reports: [{ type: 'render-analysis', result: { emptyRender: true } }],
        }) as any
      );

      await reporter.onTestRunEnd(createMockTestModules({ passed: 2, failed: 1 }) as any, []);

      expect(telemetry).toHaveBeenCalledWith(
        'ai-setup-self-healing-scoring',
        expect.objectContaining({
          agent: { name: 'claude' },
          analysis: expect.objectContaining({
            total: 3,
            passed: 2,
            passedButEmptyRender: 1,
            successRate: 0.67,
            successRateWithoutEmptyRender: 0.33,
            uniqueErrorCount: 1,
          }),
          unhandledErrorCount: 0,
          watch: false,
        }),
        { configDir: '.storybook', stripMetadata: true }
      );
    });

    it('should filter out example stories from analysis', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 'my-story--primary', status: 'passed' }) as any
      );
      reporter.onTestCaseResult(
        createMockTestCase({ storyId: 'example-button--primary', status: 'passed' }) as any
      );

      await reporter.onTestRunEnd(createMockTestModules({ passed: 2, failed: 0 }) as any, []);

      expect(telemetry).toHaveBeenCalledWith(
        'ai-setup-self-healing-scoring',
        expect.objectContaining({
          analysis: expect.objectContaining({
            total: 1,
            passed: 1,
          }),
        }),
        expect.anything()
      );
    });

    it('should count unhandled errors', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      await reporter.onTestRunEnd(
        createMockTestModules({ passed: 0, failed: 0 }) as any,
        [{ message: 'unhandled' }, { message: 'another' }] as any
      );

      expect(telemetry).toHaveBeenCalledWith(
        'ai-setup-self-healing-scoring',
        expect.objectContaining({
          unhandledErrorCount: 2,
        }),
        expect.anything()
      );
    });

    it('should reset collected results after each run', async () => {
      reporter.onInit({ config: { watch: false } } as any);

      reporter.onTestCaseResult(createMockTestCase({ storyId: 's1', status: 'passed' }) as any);
      await reporter.onTestRunEnd(createMockTestModules({ passed: 1, failed: 0 }) as any, []);

      reporter.onTestCaseResult(
        createMockTestCase({
          storyId: 's2',
          status: 'failed',
          errors: [{ message: 'err' }],
        }) as any
      );
      await reporter.onTestRunEnd(createMockTestModules({ passed: 0, failed: 1 }) as any, []);

      const secondCall = vi.mocked(telemetry).mock.calls[1];
      expect(secondCall[1]).toEqual(
        expect.objectContaining({
          analysis: expect.objectContaining({
            total: 1,
            passed: 0,
          }),
        })
      );
    });
  });
});
