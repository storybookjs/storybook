import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { global } from '@storybook/global';

import { action } from './action.ts';

vi.mock('storybook/preview-api', () => ({
  addons: { getChannel: () => ({ emit: vi.fn() }) },
}));

describe('action handler — implicit actions', () => {
  const hadPreview = '__STORYBOOK_PREVIEW__' in (global as any);
  const hadFeatures = 'FEATURES' in (globalThis as any);
  const originalPreview = (global as any).__STORYBOOK_PREVIEW__;
  const originalFeatures = (globalThis as any).FEATURES;

  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as any).FEATURES = { disallowImplicitActionsInRenderV8: true };
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    if (hadPreview) {
      (global as any).__STORYBOOK_PREVIEW__ = originalPreview;
    } else {
      delete (global as any).__STORYBOOK_PREVIEW__;
    }
    if (hadFeatures) {
      (globalThis as any).FEATURES = originalFeatures;
    } else {
      delete (globalThis as any).FEATURES;
    }
    vi.restoreAllMocks();
  });

  const setRender = (render: { phase: string; viewMode: string } | null) => {
    (global as any).__STORYBOOK_PREVIEW__ = {
      storyRenders: render ? [render] : [],
    };
  };

  it('throws when an implicit action fires during a story render', () => {
    setRender({ phase: 'rendering', viewMode: 'story' });
    const handler = action('onClick', { implicit: true });
    expect(() => handler()).toThrow(/implicit/i);
  });

  it('warns instead of throwing when the render is in docs viewMode', () => {
    setRender({ phase: 'rendering', viewMode: 'docs' });
    const handler = action('onBlabla', { implicit: true });
    expect(() => handler()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not throw when there is no active render', () => {
    setRender(null);
    const handler = action('onClick', { implicit: true });
    expect(() => handler()).not.toThrow();
  });
});
