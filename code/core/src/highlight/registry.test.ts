import { describe, expect, it, vi } from 'vitest';

import { HighlightRegistry } from './registry.ts';

const HOST = { source: 'https://preview.example/' };
const REF = { refId: 'abc', source: 'https://preview.example/' };
const MANAGER = {};

const menu = (title: string) => [[{ id: title, title }]];

describe('HighlightRegistry', () => {
  it('stores normalized highlights by id', () => {
    const registry = new HighlightRegistry();
    expect(registry.add(HOST, { id: 'h1', selectors: ['#target'], menu: menu('Host') })).toBe(true);

    expect(registry.find('h1')).toEqual({
      id: 'h1',
      priority: 0,
      selectors: ['#target'],
      styles: { outline: '2px dashed #029cfd' },
      menu: menu('Host'),
    });
  });

  it('ignores malformed highlights', () => {
    const registry = new HighlightRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);

    expect(registry.add(HOST, null)).toBe(false);
    expect(registry.add(HOST, {})).toBe(false);
    expect(registry.add(HOST, { id: '', selectors: ['#target'] })).toBe(false);
    expect(registry.add(HOST, { id: 'h1', selectors: 'nope' })).toBe(false);
    expect(registry.find('h1')).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it('removes a highlight when it is registered without selectors', () => {
    const registry = new HighlightRegistry();
    registry.add(HOST, { id: 'h1', selectors: ['#target'], menu: menu('Host') });

    expect(registry.add(HOST, { id: 'h1' })).toBe(true);
    expect(registry.find('h1')).toBeUndefined();
  });

  it('scopes entries to the frame that announced them', () => {
    const registry = new HighlightRegistry();
    registry.add(HOST, { id: 'dup', selectors: ['#target'], menu: menu('Host') });
    registry.add(REF, { id: 'dup', selectors: ['#target'], menu: menu('Ref') });

    expect(registry.find('dup')?.menu).toEqual(menu('Host'));
    expect(registry.find('dup', 'abc')?.menu).toEqual(menu('Ref'));
  });

  it('falls back to manager-local registrations for every frame', () => {
    const registry = new HighlightRegistry();
    registry.add(MANAGER, { id: 'shared', selectors: ['#target'], menu: menu('Manager') });

    expect(registry.find('shared')?.menu).toEqual(menu('Manager'));
    expect(registry.find('shared', 'abc')?.menu).toEqual(menu('Manager'));
  });

  it('keeps host and manager-local registrations in separate buckets', () => {
    const registry = new HighlightRegistry();
    registry.add(MANAGER, { id: 'dup', selectors: ['#target'], menu: menu('Manager') });
    registry.add(HOST, { id: 'dup', selectors: ['#target'], menu: menu('Host') });

    expect(registry.find('dup')?.menu).toEqual(menu('Host'));
    expect(registry.find('dup', 'abc')?.menu).toEqual(menu('Manager'));
  });

  it('scopes resets to their origin', () => {
    const registry = new HighlightRegistry();
    registry.add(HOST, { id: 'host', selectors: ['#target'], menu: menu('Host') });
    registry.add(REF, { id: 'ref', selectors: ['#target'], menu: menu('Ref') });
    registry.add(MANAGER, { id: 'manager', selectors: ['#target'], menu: menu('Manager') });

    registry.reset(REF);
    expect(registry.find('ref', 'abc')).toBeUndefined();
    expect(registry.find('host')).toBeDefined();
    expect(registry.find('manager', 'abc')).toBeDefined();

    registry.reset(HOST);
    expect(registry.find('host')).toBeUndefined();
    expect(registry.find('manager', 'abc')).toBeDefined();

    registry.reset(MANAGER);
    expect(registry.find('manager', 'abc')).toBeUndefined();
  });

  it('clears only the frame that starts rendering', () => {
    const registry = new HighlightRegistry();
    registry.add(HOST, { id: 'host', selectors: ['#target'] });
    registry.add(REF, { id: 'ref', selectors: ['#target'] });

    registry.clearFrame('abc');
    expect(registry.find('ref', 'abc')).toBeUndefined();
    expect(registry.find('host')).toBeDefined();

    registry.clearFrame();
    expect(registry.find('host')).toBeUndefined();
  });

  it('notifies subscribers of changes and stops after unsubscribe', () => {
    const registry = new HighlightRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);

    registry.add(HOST, { id: 'h1', selectors: ['#target'] });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    registry.add(HOST, { id: 'h2', selectors: ['#target'] });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
