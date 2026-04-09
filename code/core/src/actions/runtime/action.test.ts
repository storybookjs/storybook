import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { global } from '@storybook/global';

import { action } from './action';

vi.mock('storybook/preview-api', () => ({
  addons: { getChannel: () => ({ emit: vi.fn() }) },
}));

describe('action handler — implicit actions', () => {
  const originalPreview = (global as any).__STORYBOOK_PREVIEW__;
  const originalFeatures = (globalThis as any).FEATURES;

  beforeEach(() => {
    (globalThis as any).FEATURES = { disallowImplicitActionsInRenderV8: true };
  });

  afterEach(() => {
    (global as any).__STORYBOOK_PREVIEW__ = originalPreview;
    (globalThis as any).FEATURES = originalFeatures;
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handler = action('onBlabla', { implicit: true });
    expect(() => handler()).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it('does not throw when there is no active render', () => {
    setRender(null);
    const handler = action('onClick', { implicit: true });
    expect(() => handler()).not.toThrow();
  });
});
