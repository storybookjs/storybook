import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

interface StubWindow {
  top?: unknown;
  document?: unknown;
  __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown;
  __VUE_DEVTOOLS_GLOBAL_HOOK__?: unknown;
  __VUE_DEVTOOLS_CONTEXT__?: unknown;
}

const basePreviewHead = readFileSync(
  new URL('../../../../assets/server/base-preview-head.html', import.meta.url),
  'utf8'
);

const runDevToolsBridge = (previewWindow: StubWindow) => {
  const scriptBody = /<script>([\s\S]*?)<\/script>/.exec(basePreviewHead)?.[1];

  if (!scriptBody) {
    throw new Error('base-preview-head.html no longer contains an inline script');
  }

  new Function('window', scriptBody)(previewWindow);
};

describe('base-preview-head.html dev tools bridge', () => {
  it('copies the dev tools hooks from the top frame when it has them', () => {
    const reactHook = { renderers: new Map() };
    const vueHook = { apps: [] };
    const topWindow: StubWindow = {
      __REACT_DEVTOOLS_GLOBAL_HOOK__: reactHook,
      __VUE_DEVTOOLS_GLOBAL_HOOK__: vueHook,
    };
    const previewDocument = {};
    const previewWindow: StubWindow = { top: topWindow, document: previewDocument };

    runDevToolsBridge(previewWindow);

    expect(previewWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__).toBe(reactHook);
    expect(previewWindow.__VUE_DEVTOOLS_GLOBAL_HOOK__).toBe(vueHook);
    expect(topWindow.__VUE_DEVTOOLS_CONTEXT__).toBe(previewDocument);
  });

  it('leaves the hook keys absent when the top frame has none', () => {
    const previewWindow: StubWindow = { top: {}, document: {} };

    runDevToolsBridge(previewWindow);

    expect('__REACT_DEVTOOLS_GLOBAL_HOOK__' in previewWindow).toBe(false);
    expect('__VUE_DEVTOOLS_GLOBAL_HOOK__' in previewWindow).toBe(false);
  });

  it('keeps a hook the preview installed itself when the top frame has none', () => {
    const previewHook = { renderers: new Map() };
    const previewWindow: StubWindow = {
      top: {},
      document: {},
      __REACT_DEVTOOLS_GLOBAL_HOOK__: previewHook,
    };

    runDevToolsBridge(previewWindow);

    expect(previewWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__).toBe(previewHook);
  });

  it('does nothing when the preview is not framed', () => {
    const previewWindow: StubWindow = { document: {} };
    previewWindow.top = previewWindow;

    runDevToolsBridge(previewWindow);

    expect('__REACT_DEVTOOLS_GLOBAL_HOOK__' in previewWindow).toBe(false);
    expect('__VUE_DEVTOOLS_CONTEXT__' in previewWindow).toBe(false);
  });
});
