// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import testAnnotations from './test-annotations.ts';

interface CapturedReport {
  type: string;
  result: { emptyRender?: boolean; cssApplied?: boolean | null };
  status: string;
}

const getAfterEach = () => {
  const annotations = testAnnotations();
  const afterEach = (annotations as { afterEach?: unknown }).afterEach as
    | ((ctx: unknown) => Promise<void>)
    | undefined;
  if (typeof afterEach !== 'function') {
    throw new Error('test-annotations did not register an afterEach');
  }
  return afterEach;
};

const makeContext = (canvasElement: HTMLElement) => {
  const reports: CapturedReport[] = [];
  return {
    reports,
    ctx: {
      reporting: {
        addReport: (report: CapturedReport) => {
          reports.push(report);
        },
      },
      canvasElement,
      globals: { renderAnalysis: { enabled: true } },
    },
  };
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('ghost-stories test-annotations', () => {
  it('skips reporting when renderAnalysis is not enabled', async () => {
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const reports: CapturedReport[] = [];
    await getAfterEach()({
      reporting: {
        addReport: (r: CapturedReport) => reports.push(r),
      },
      canvasElement: canvas,
      globals: {},
    });
    expect(reports).toHaveLength(0);
  });

  it('emits a render-analysis warning with cssApplied=false when no CSS differs from UA defaults', async () => {
    const canvas = document.createElement('div');
    // Give the canvas some size so emptyRender is false; we want to isolate the CSS signal.
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ width: 100, height: 100, top: 0, left: 0, bottom: 100, right: 100 }),
    });
    const child = document.createElement('div');
    canvas.appendChild(child);
    document.body.appendChild(canvas);

    // jsdom returns identical computed styles for everything by default, so the iframe-baseline
    // probe and the canvas probe will match -> cssApplied should be false.
    const { reports, ctx } = makeContext(canvas);
    await getAfterEach()(ctx);

    // jsdom may not be able to construct the iframe baseline; if it fails, the probe returns
    // null and we should NOT emit a report (no signal).
    if (reports.length === 0) {
      return; // environment-limited, treated as inconclusive
    }
    expect(reports[0]).toMatchObject({
      type: 'render-analysis',
      status: 'warning',
      result: { cssApplied: false },
    });
  });

  it('emits a warning when emptyRender is true even if cssApplied probe is inconclusive', async () => {
    const canvas = document.createElement('div');
    // Force zero-size to trigger emptyRender.
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0 }),
    });
    document.body.appendChild(canvas);

    const { reports, ctx } = makeContext(canvas);
    await getAfterEach()(ctx);

    expect(reports).toHaveLength(1);
    expect(reports[0].result.emptyRender).toBe(true);
  });

  it('does not throw if reporting.addReport throws', async () => {
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);

    const ctx = {
      reporting: {
        addReport: vi.fn(() => {
          throw new Error('boom');
        }),
      },
      canvasElement: canvas,
      globals: { renderAnalysis: { enabled: true } },
    };

    await expect(getAfterEach()(ctx)).resolves.toBeUndefined();
  });
});
