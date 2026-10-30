import { describe, expect, it } from 'vitest';

import {
  COMPACT_FRAME_MIN_HEIGHT,
  DOCS_ARTICLE_ALIGN,
  applyReportedHeight,
  displayedFrameHeight,
  nextContentReport,
  ratioFrameHeight,
  stablePaneHeight,
  storyFrameStyle,
  type FrameHeightState,
} from './frame-height.ts';

const compact: FrameHeightState = { applied: COMPACT_FRAME_MIN_HEIGHT, reported: null, growth: 0 };

describe('frame height', () => {
  it('updates from a height event and ignores a negative report and a resize loop', () => {
    const grown = applyReportedHeight(compact, undefined, 480, 1040);
    expect(grown.changed).toBe(true);
    expect(grown.state.applied).toBe(480);

    const negative = applyReportedHeight(grown.state, undefined, -1, 1040);
    expect(negative.changed).toBe(false);
    expect(negative.state.applied).toBe(480);

    const echo = applyReportedHeight(grown.state, undefined, 480, 1040);
    expect(echo.changed).toBe(false);
    expect(echo.state.applied).toBe(480);

    const tracking = applyReportedHeight(grown.state, undefined, 480 + grown.state.growth, 1040);
    expect(tracking.changed).toBe(false);
    expect(tracking.state.applied).toBe(480);
    const again = applyReportedHeight(
      tracking.state,
      undefined,
      480 + grown.state.growth * 2,
      1040
    );
    expect(again.changed).toBe(false);
    expect(again.state.applied).toBe(480);

    expect(nextContentReport(null, -20, 200)).toBeNull();
    expect(nextContentReport(null, Number.NaN, 200)).toBeNull();
    expect(nextContentReport(480, 480, 200)).toBeNull();
    expect(nextContentReport(null, 1040, 1040)).toBeNull();
    expect(nextContentReport(null, 480, 200)).toBe(480);
  });

  it('keeps an explicit 100vh frame on the manager pane when content reports its own height', () => {
    const pane = stablePaneHeight([2272, 1040, 1400]);
    expect(pane).toBe(1040);

    const fixed = applyReportedHeight(
      { applied: pane, reported: null, growth: 0 },
      '100vh',
      2473,
      pane
    );
    expect(fixed.changed).toBe(false);
    expect(fixed.state.applied).toBe(1040);
    expect(displayedFrameHeight('100vh', 2473, pane)).toBe(1040);

    const resized = applyReportedHeight(fixed.state, '100vh', 2473, 640);
    expect(resized.changed).toBe(true);
    expect(resized.state.applied).toBe(640);
  });

  it('keeps a pixel height fixed when content reports a different height', () => {
    const pinned = { applied: 480, reported: null, growth: 0 };
    const report = applyReportedHeight(pinned, 480, 1200, 1040);
    expect(report.changed).toBe(false);
    expect(report.state.applied).toBe(480);
    expect(displayedFrameHeight(480, 1200, 1040)).toBe(480);
    expect(storyFrameStyle(480, undefined, 1200, 1040)).toEqual({ height: 480 });

    const applied = applyReportedHeight(compact, 320, 900, 1040);
    expect(applied.state.applied).toBe(320);
    const again = applyReportedHeight(applied.state, 320, 1400, 640);
    expect(again.changed).toBe(false);
    expect(again.state.applied).toBe(320);
  });

  it('derives a ratio frame from its width and ignores content growth', () => {
    const ratio = 16 / 9;
    expect(ratioFrameHeight(960, ratio)).toBe(540);
    expect(ratioFrameHeight(375, ratio)).toBeCloseTo((375 * 9) / 16);
    expect(ratioFrameHeight(768, 1.5)).toBe(512);

    const applied = ratioFrameHeight(960, ratio);
    const report = applyReportedHeight(
      { applied, reported: null, growth: 0 },
      undefined,
      2000,
      1040,
      ratio
    );
    expect(report.changed).toBe(false);
    expect(report.state.applied).toBe(540);
    expect(storyFrameStyle(undefined, ratio, 2000, 1040)).toEqual({
      height: 'auto',
      aspectRatio: ratio,
    });
  });

  it('keeps an ordinary story in a bounded top-aligned frame', () => {
    expect(DOCS_ARTICLE_ALIGN).toEqual({
      alignSelf: 'start',
      justifySelf: 'stretch',
      width: '100%',
    });
    expect(displayedFrameHeight(undefined, 40, 1040)).toBe(COMPACT_FRAME_MIN_HEIGHT);
    expect(displayedFrameHeight(undefined, 40, 1040)).toBeLessThan(1040);
    expect(displayedFrameHeight(undefined, undefined, 1040)).toBe(COMPACT_FRAME_MIN_HEIGHT);
  });
});
