// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoryContext } from '@storybook/csf';

import { run } from './a11yRunner';
import { A11Y_TEST_TAG } from './constants';
import { experimental_afterEach } from './preview';
import { getIsVitestRunning, getIsVitestStandaloneRun } from './utils';

const mocks = vi.hoisted(() => {
  return {
    getIsVitestRunning: vi.fn(),
    getIsVitestStandaloneRun: vi.fn(),
  };
});

vi.mock(import('./a11yRunner'));
vi.mock(import('./utils'), async (importOriginal) => {
  const mod = await importOriginal(); // type is inferred
  return {
    ...mod,
    getIsVitestRunning: mocks.getIsVitestRunning,
    getIsVitestStandaloneRun: mocks.getIsVitestStandaloneRun,
  };
});

const mockedRun = vi.mocked(run);

const violations = [
  {
    id: 'color-contrast',
    impact: 'serious',
    tags: '_duplicate_["args","0","reporters","0","result","passes","12","tags"]',
    description:
      'Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds',
    help: 'Elements must meet minimum color contrast ratio thresholds',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.8/color-contrast?application=axeAPI',
    nodes: [
      {
        any: [
          {
            id: 'color-contrast',
            data: {
              fgColor: '#029cfd',
              bgColor: '#f6f9fc',
              contrastRatio: 2.76,
              fontSize: '10.5pt (14px)',
              fontWeight: 'normal',
              messageKey: null,
              expectedContrastRatio: '4.5:1',
              shadowColor: '_undefined_',
            },
            relatedNodes: [
              {
                html: '<div class="css-1av19vu">',
                target: ['.css-1av19vu'],
              },
            ],
            impact: 'serious',
            message:
              'Element has insufficient color contrast of 2.76 (foreground color: #029cfd, background color: #f6f9fc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
            '_constructor-name_': 'CheckResult',
          },
        ],
        all: [],
        none: [],
        impact: 'serious',
        html: '<span class="css-1mjgzsp">',
        target: ['.css-1mjgzsp'],
        failureSummary:
          'Fix any of the following:\n  Element has insufficient color contrast of 2.76 (foreground color: #029cfd, background color: #f6f9fc, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1',
      },
    ],
  },
];

describe('afterEach', () => {
  beforeEach(() => {
    vi.mocked(getIsVitestRunning).mockReturnValue(false);
    vi.mocked(getIsVitestStandaloneRun).mockReturnValue(true);
  });

  const createContext = (overrides: Partial<StoryContext> = {}): StoryContext =>
    ({
      reporting: {
        reports: [],
        addReport: vi.fn(),
      },
      parameters: {
        a11y: {},
      },
      globals: {
        a11y: {},
      },
      tags: [A11Y_TEST_TAG],
      ...overrides,
    }) as any;

  it('should run accessibility checks and report results', async () => {
    const context = createContext();
    const result = {
      violations,
    };

    mockedRun.mockResolvedValue(result as any);

    await expect(() => experimental_afterEach(context)).rejects.toThrow();

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);

    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result,
      status: 'failed',
    });
  });

  it('should run accessibility checks and report results without throwing', async () => {
    const context = createContext();
    const result = {
      violations,
    };

    mockedRun.mockResolvedValue(result as any);
    mocks.getIsVitestStandaloneRun.mockReturnValue(false);

    await experimental_afterEach(context);

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);

    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result,
      status: 'failed',
    });
  });

  it('should report passed status when there are no violations', async () => {
    const context = createContext();
    const result = {
      violations: [],
    };
    mockedRun.mockResolvedValue(result as any);

    await experimental_afterEach(context);

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);
    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result,
      status: 'passed',
    });
  });

  it('should report warning status when there are only warnings', async () => {
    const context = createContext({
      parameters: {
        a11y: {
          warnings: ['minor'],
        },
      },
    });
    const result = {
      violations: [
        { impact: 'minor', nodes: [] },
        { impact: 'critical', nodes: [] },
      ],
    };
    mockedRun.mockResolvedValue(result as any);

    await expect(async () => experimental_afterEach(context)).rejects.toThrow();

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);
    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result,
      status: 'failed',
    });
  });

  it('should report error status when there are warnings and errors', async () => {
    const context = createContext({
      parameters: {
        a11y: {
          warnings: ['minor'],
        },
      },
    });
    const result = {
      violations: [
        { impact: 'minor', nodes: [] },
        { impact: 'critical', nodes: [] },
      ],
    };
    mockedRun.mockResolvedValue(result as any);

    await expect(async () => experimental_afterEach(context)).rejects.toThrow();

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);
    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result,
      status: 'failed',
    });
  });

  it('should run accessibility checks if "a11ytest" flag is not available and is not running in Vitest', async () => {
    const context = createContext({
      tags: [],
    });
    const result = {
      violations: [],
    };
    mockedRun.mockResolvedValue(result as any);
    vi.mocked(getIsVitestRunning).mockReturnValue(false);

    await experimental_afterEach(context);

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);
    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result,
      status: 'passed',
    });
  });

  it('should not run accessibility checks when manual is true', async () => {
    const context = createContext({
      parameters: {
        a11y: {
          manual: true,
        },
      },
    });

    await experimental_afterEach(context);

    expect(mockedRun).not.toHaveBeenCalled();
    expect(context.reporting.addReport).not.toHaveBeenCalled();
  });

  it('should not run accessibility checks when disable is true', async () => {
    const context = createContext({
      parameters: {
        a11y: {
          disable: true,
        },
      },
    });

    await experimental_afterEach(context);

    expect(mockedRun).not.toHaveBeenCalled();
    expect(context.reporting.addReport).not.toHaveBeenCalled();
  });

  it('should not run accessibility checks when globals manual is true', async () => {
    const context = createContext({
      globals: {
        a11y: {
          manual: true,
        },
      },
    });

    await experimental_afterEach(context);

    expect(mockedRun).not.toHaveBeenCalled();
    expect(context.reporting.addReport).not.toHaveBeenCalled();
  });

  it('should not run accessibility checks if vitest is running and story is not tagged with a11ytest', async () => {
    const context = createContext({
      tags: [],
    });
    vi.mocked(getIsVitestRunning).mockReturnValue(true);

    await experimental_afterEach(context);

    expect(mockedRun).not.toHaveBeenCalled();
    expect(context.reporting.addReport).not.toHaveBeenCalled();
  });

  it('should report error when run throws an error', async () => {
    const context = createContext();
    const error = new Error('Test error');
    mockedRun.mockRejectedValue(error);

    await expect(() => experimental_afterEach(context)).rejects.toThrow();

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);
    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result: {
        error,
      },
      status: 'failed',
    });
  });

  it('should report error when run throws an error', async () => {
    const context = createContext();
    const error = new Error('Test error');
    mockedRun.mockRejectedValue(error);

    await expect(() => experimental_afterEach(context)).rejects.toThrow();

    expect(mockedRun).toHaveBeenCalledWith(context.parameters.a11y);
    expect(context.reporting.addReport).toHaveBeenCalledWith({
      type: 'a11y',
      version: 1,
      result: {
        error,
      },
      status: 'failed',
    });
  });
});
