import { describe, expect, it } from 'vitest';

import type { ClickEventDetails, HighlightMenuState, HighlightMenuTarget } from './types.ts';
import {
  isHighlightOptions,
  parseHighlightMenuInteraction,
  parseHighlightMenuState,
} from './validation.ts';

const details = (overrides: Partial<ClickEventDetails> = {}): ClickEventDetails => ({
  top: 10,
  left: 20,
  width: 30,
  height: 40,
  selectors: ['#target'],
  element: { localName: 'div', tagName: 'DIV' },
  ...overrides,
});

const target = (overrides: Partial<HighlightMenuTarget> = {}): HighlightMenuTarget => ({
  key: '1',
  id: 'h1',
  label: 'div#target',
  details: details(),
  ...overrides,
});

type OpenState = Extract<HighlightMenuState, { open: true }>;

const state = (overrides: Partial<OpenState> = {}): OpenState => ({
  open: true,
  targets: [target()],
  selected: null,
  coords: { x: 10, y: 20 },
  ...overrides,
});

describe('parseHighlightMenuState', () => {
  it('accepts a valid open state', () => {
    expect(parseHighlightMenuState(state())).toEqual(state());
  });

  it('accepts a selected target by key', () => {
    const value = state({ targets: [target(), target({ key: '2' })], selected: '2' });
    expect(parseHighlightMenuState(value)).toEqual(value);
  });

  it('accepts a closed state', () => {
    expect(parseHighlightMenuState({ open: false })).toEqual({ open: false });
  });

  it.each([
    null,
    undefined,
    {},
    { targets: [target()], selected: null, coords: { x: 0, y: 0 } },
    state({ targets: 'nope' as never }),
    state({ targets: [] }),
    state({ targets: [null as never] }),
    state({ targets: [target({ key: '' })] }),
    state({ targets: [target(), target()] }),
    state({ targets: [target({ id: '' })] }),
    state({ targets: [target({ label: 1 as never })] }),
    state({ targets: [target({ details: { ...details(), selectors: 'nope' as never } })] }),
    state({ targets: [target({ details: { ...details(), top: Number.NaN } })] }),
    state({ targets: [target({ details: { ...details(), element: null as never } })] }),
    state({ selected: '2' }),
    state({ selected: 0 as never }),
    state({ coords: null as never }),
    state({ coords: { x: Number.POSITIVE_INFINITY, y: 0 } }),
    state({ coords: 'nope' as never }),
  ])('rejects malformed state %#', (value) => {
    expect(parseHighlightMenuState(value)).toBeUndefined();
  });
});

describe('parseHighlightMenuInteraction', () => {
  it('accepts valid actions', () => {
    expect(parseHighlightMenuInteraction({ action: 'select', key: '1' })).toEqual({
      action: 'select',
      key: '1',
    });
    expect(parseHighlightMenuInteraction({ action: 'focus', key: '2' })).toEqual({
      action: 'focus',
      key: '2',
    });
    expect(parseHighlightMenuInteraction({ action: 'deselect' })).toEqual({ action: 'deselect' });
    expect(parseHighlightMenuInteraction({ action: 'blur' })).toEqual({ action: 'blur' });
    expect(parseHighlightMenuInteraction({ action: 'close' })).toEqual({ action: 'close' });
  });

  it.each([
    null,
    undefined,
    {},
    { action: 'select' },
    { action: 'select', key: '' },
    { action: 'select', key: 1 },
    { action: 'focus', key: null },
    { action: 'unknown', key: '1' },
  ])('rejects malformed interaction %#', (value) => {
    expect(parseHighlightMenuInteraction(value)).toBeUndefined();
  });
});

describe('isHighlightOptions', () => {
  it('accepts an id with selectors', () => {
    expect(isHighlightOptions({ id: 'h1', selectors: ['#target'] })).toBe(true);
  });

  it('accepts an id without selectors so the preview can remove it', () => {
    expect(isHighlightOptions({ id: 'h1' })).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { id: '', selectors: ['#target'] },
    { id: 'h1', selectors: 'nope' },
    { id: 'h1', selectors: [1] },
  ])('rejects malformed highlight %#', (value) => {
    expect(isHighlightOptions(value)).toBe(false);
  });
});
