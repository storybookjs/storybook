// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';

it('instruments assertion chains and asymmetric matchers', async () => {
  const url = window.location.href;
  window.history.replaceState({}, '', '?instrument=true');
  vi.stubGlobal('__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__', undefined);
  vi.stubGlobal('__STORYBOOK_PREVIEW__', {
    selectionStore: { selection: { storyId: 'instrumented-expect' } },
  });
  vi.resetModules();

  try {
    const { expect: storybookExpect } = await import('./index.ts');

    storybookExpect('storybook').not.not.not.toEqual('vitest');
    storybookExpect({ name: 'storybook' }).toEqual({ name: storybookExpect.any(String) });
    storybookExpect({ name: 'storybook' }).to.have.any.keys('name');

    expect(storybookExpect.any).toBeTypeOf('function');
    expect(
      window.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER__
        .getLog('instrumented-expect')
        .map((call: { callId: string }) => call.callId.split(' ').at(-1))
    ).toEqual(['toEqual', 'toEqual']);
  } finally {
    window.history.replaceState({}, '', url);
    vi.unstubAllGlobals();
  }
});
