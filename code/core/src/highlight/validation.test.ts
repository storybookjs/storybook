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
  id: 'h1',
  label: 'div#target',
  details: details(),
  ...overrides,
});

const state = (overrides: Partial<HighlightMenuState> = {}): HighlightMenuState => ({
  targets: [target()],
  selected: null,
  coords: { x: 10, y: 20 },
  ...overrides,
});

describe('parseHighlightMenuState', () => {
  it('accepts a valid open state', () => {
    expect(parseHighlightMenuState(state())).toEqual(state());
  });

  it('accepts a hidden state', () => {
    expect(parseHighlightMenuState({ targets: [], selected: null, coords: null })).toEqual({
      targets: [],
      selected: null,
      coords: null,
    });
  });

  it.each([
    null,
    undefined,
    {},
    { targets: 'nope', selected: null, coords: null },
    { targets: [], selected: 0, coords: null },
    { targets: [], selected: null, coords: { x: 0, y: 0 } },
    { targets: [null], selected: null, coords: { x: 0, y: 0 } },
    { targets: [{ ...target(), id: '' }], selected: null, coords: { x: 0, y: 0 } },
    { targets: [{ ...target(), label: 1 }], selected: null, coords: { x: 0, y: 0 } },
    {
      targets: [{ ...target(), details: { ...details(), selectors: 'nope' } }],
      selected: null,
      coords: { x: 0, y: 0 },
    },
    {
      targets: [{ ...target(), details: { ...details(), top: Number.NaN } }],
      selected: null,
      coords: { x: 0, y: 0 },
    },
    {
      targets: [{ ...target(), details: { ...details(), element: null } }],
      selected: null,
      coords: { x: 0, y: 0 },
    },
    { targets: [target()], selected: 1, coords: { x: 0, y: 0 } },
    { targets: [target()], selected: -1, coords: { x: 0, y: 0 } },
    { targets: [target()], selected: 0.5, coords: { x: 0, y: 0 } },
    { targets: [target()], selected: null, coords: { x: Number.POSITIVE_INFINITY, y: 0 } },
    { targets: [target()], selected: null, coords: 'nope' },
  ])('rejects malformed state %#', (value) => {
    expect(parseHighlightMenuState(value)).toBeUndefined();
  });
});

describe('parseHighlightMenuInteraction', () => {
  it('accepts valid actions', () => {
    expect(parseHighlightMenuInteraction({ action: 'select', index: 1 }, 2)).toEqual({
      action: 'select',
      index: 1,
    });
    expect(parseHighlightMenuInteraction({ action: 'focus', index: 0 }, 2)).toEqual({
      action: 'focus',
      index: 0,
    });
    expect(parseHighlightMenuInteraction({ action: 'deselect' }, 2)).toEqual({
      action: 'deselect',
    });
    expect(parseHighlightMenuInteraction({ action: 'blur' }, 2)).toEqual({ action: 'blur' });
    expect(parseHighlightMenuInteraction({ action: 'close' }, 2)).toEqual({ action: 'close' });
  });

  it.each([
    null,
    undefined,
    {},
    { action: 'select' },
    { action: 'select', index: -1 },
    { action: 'select', index: 2 },
    { action: 'select', index: 0.5 },
    { action: 'select', index: '0' },
    { action: 'select', index: '__proto__' },
    { action: 'focus', index: Number.NaN },
    { action: 'unknown', index: 0 },
  ])('rejects malformed interaction %#', (value) => {
    expect(parseHighlightMenuInteraction(value, 2)).toBeUndefined();
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
