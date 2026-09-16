import { describe, expect, it } from 'vitest';

import { devtoolsSpikePlugin, injectDevtoolsClient, resolveClientEntry } from './vite-plugin.ts';

const HTML = '<!doctype html><html><head><title>demo</title></head><body></body></html>';
const INJECTED = '<script type="module" src="/@id/virtual:sb-devtools-client"></script>';

describe('dev-only client injection (transformIndexHtml behavior)', () => {
  it('injects the client script right after <head> when serving', () => {
    expect(injectDevtoolsClient(HTML, 'serve')).toBe(
      '<!doctype html><html><head>' + INJECTED + '<title>demo</title></head><body></body></html>'
    );
  });

  it('returns the html unchanged for production builds', () => {
    expect(injectDevtoolsClient(HTML, 'build')).toBe(HTML);
  });

  it('treats an unresolved command as no injection', () => {
    expect(injectDevtoolsClient(HTML, undefined)).toBe(HTML);
  });

  it('leaves html without a <head> untouched even when serving', () => {
    expect(injectDevtoolsClient('<html><body></body></html>', 'serve')).toBe(
      '<html><body></body></html>'
    );
  });
});

describe('plugin shape', () => {
  it('resolves only the devtools virtual module to the client entry', () => {
    const plugin = devtoolsSpikePlugin({ storiesGlob: 'src/**' });
    expect(plugin.name).toBe('storybook:devtools-spike');
    expect(plugin.resolveId).toBe(resolveClientEntry);
    const resolved = resolveClientEntry('virtual:sb-devtools-client');
    expect(typeof resolved).toBe('string');
    expect(resolved).toContain('client/entry.ts');
    expect(resolveClientEntry('some/other/module')).toBeUndefined();
  });
});
