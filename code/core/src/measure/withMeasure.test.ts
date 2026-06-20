// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoryContext } from 'storybook/internal/types';

vi.mock('storybook/preview-api', () => ({
  useEffect: (cb: () => void) => {
    cb();
  },
}));

vi.mock('./box-model/canvas.ts', () => ({
  init: vi.fn(),
  destroy: vi.fn(),
  rescale: vi.fn(),
}));
vi.mock('./box-model/visualizer.ts', () => ({
  drawSelectedElement: vi.fn(),
}));

import * as canvas from './box-model/canvas.ts';
import { withMeasure } from './withMeasure.ts';

const runDecorator = (context: Partial<StoryContext>) =>
  withMeasure(() => 'story', {
    viewMode: 'story',
    ...context,
  } as StoryContext);

describe('withMeasure', () => {
  beforeEach(() => {
    vi.mocked(canvas.init).mockClear();
  });

  it('activates the measure overlay when the measureEnabled global is set', () => {
    runDecorator({ globals: { measureEnabled: true }, parameters: {} });
    expect(canvas.init).toHaveBeenCalled();
  });

  it('does not activate when disabled via parameters, even if the global is on', () => {
    runDecorator({
      globals: { measureEnabled: true },
      parameters: { measure: { disable: true } },
    });
    expect(canvas.init).not.toHaveBeenCalled();
  });
});
