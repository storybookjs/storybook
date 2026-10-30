import { Channel } from 'storybook/internal/channels';
import { describe, expect, it, vi } from 'vitest';

import {
  COMPONENT_BLOCKS_REQUEST,
  COMPONENT_BLOCKS_SERVER,
  STATIC_COMPONENT_BLOCKS_FILE,
} from '../constants.ts';
import {
  componentBlocksUrl,
  loadComponentBlocks,
  staticComponentBlocksUrl,
} from './component-blocks.ts';

const managerLocation = {
  protocol: 'http:',
  hostname: '127.0.0.1',
  href: 'http://127.0.0.1:6006/',
};

type FakeScript = { type: string; src: string; attributes: Set<string> };

function managerDocument() {
  const scripts: FakeScript[] = [];
  const doc = {
    location: managerLocation,
    createElement: () => {
      const attributes = new Set<string>();
      return {
        type: '',
        src: '',
        attributes,
        setAttribute: (name: string) => attributes.add(name),
      };
    },
    querySelector: (selector: string) =>
      scripts.find((script) =>
        [...script.attributes].some((name) => selector === `script[${name}]`)
      ) ?? null,
    head: { append: (script: FakeScript) => scripts.push(script) },
  };
  return { doc: doc as unknown as Document, scripts };
}

describe('loadComponentBlocks', () => {
  it('asks for the block server and loads its bundle once as a module script', () => {
    const { doc, scripts } = managerDocument();
    const channel = new Channel({});
    const requests = vi.fn();
    channel.on(COMPONENT_BLOCKS_REQUEST, requests);

    const stop = loadComponentBlocks(channel, doc);
    channel.emit(COMPONENT_BLOCKS_SERVER, { port: 6012, entry: '/manager-docs-blocks.js' });
    channel.emit(COMPONENT_BLOCKS_SERVER, { port: 6012, entry: '/manager-docs-blocks.js' });
    loadComponentBlocks(channel, doc);
    channel.emit(COMPONENT_BLOCKS_SERVER, { port: 6012, entry: '/manager-docs-blocks.js' });
    stop();

    expect(requests).toHaveBeenCalledTimes(2);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.type).toBe('module');
    expect(scripts[0]?.src).toBe('http://127.0.0.1:6012/manager-docs-blocks.js');
  });

  it('serves the bundle from the manager host on the block server port', () => {
    expect(
      componentBlocksUrl({ port: 6012, entry: '/manager-docs-blocks.js' }, managerLocation)
    ).toBe('http://127.0.0.1:6012/manager-docs-blocks.js');
  });

  it('loads the static blocks file next to the manager in production', () => {
    const { doc, scripts } = managerDocument();
    const channel = new Channel({});
    const requests = vi.fn();
    channel.on(COMPONENT_BLOCKS_REQUEST, requests);

    loadComponentBlocks(channel, doc, true);

    expect(requests).not.toHaveBeenCalled();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.type).toBe('module');
    expect(scripts[0]?.src).toBe(staticComponentBlocksUrl({ href: 'http://127.0.0.1:6006/' }));
    expect(scripts[0]?.src).toContain(STATIC_COMPONENT_BLOCKS_FILE);
  });
});
