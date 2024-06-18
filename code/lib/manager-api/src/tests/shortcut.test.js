// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { global } from '@storybook/global';
import { eventToShortcut, keyToSymbol } from '../lib/shortcut';

const { KeyboardEvent } = global;
const ev = (attr) => new KeyboardEvent('keydown', { ...attr });

describe('eventToShortcut', () => {
  it('handles alt key inputs', () => {
    const output = eventToShortcut(ev({ altKey: true, key: 'Alt' }));

    expect(output).toEqual(null);
  });
  it('handles ctrl key inputs', () => {
    const output = eventToShortcut(ev({ ctrlKey: true, key: 'Control' }));
    expect(output).toEqual(null);
  });
  it('handles meta key inputs', () => {
    const output = eventToShortcut(ev({ metaKey: true, key: 'Meta' }));
    expect(output).toEqual(null);
  });
  it('handles shift key inputs', () => {
    const output = eventToShortcut(ev({ shiftKey: true, key: 'Shift' }));
    expect(output).toEqual(null);
  });
  it('handles enter key inputs', () => {
    const output = eventToShortcut(ev({ key: 'Enter' }));
    expect(output).toEqual(null);
  });
  it('handles tab key inputs', () => {
    const output = eventToShortcut(ev({ key: 'Tab' }));
    expect(output).toEqual(null);
  });
  it('handles space bar inputs', () => {
    const output = eventToShortcut(ev({ key: ' ' }));
    expect(output).toEqual(['space']);
  });
  it('handles escape inputs', () => {
    const output = eventToShortcut(ev({ key: 'Escape' }));
    expect(output).toEqual(['escape']);
  });
  it('capitalizes a letter key through', () => {
    const output = eventToShortcut(ev({ key: 'a', code: 'KeyA' }));
    expect(output).toEqual(['A']);
  });
  it('passes regular key through', () => {
    const output = eventToShortcut(ev({ key: '1', code: 'Digit1' }));
    expect(output).toEqual(['1']);
  });
  it('passes modified regular key through', () => {
    const output = eventToShortcut(ev({ altKey: true, key: '1', code: 'Digit1' }));
    expect(output).toEqual(['alt', '1']);
    // on macos
    const outputMacOs = eventToShortcut(ev({ altKey: true, key: '√', code: 'KeyV' }));
    expect(outputMacOs).toEqual(['alt', ['√', 'V']]);
  });
});

describe('keyToSymbol', () => {
  it('control returns a caret', () => {
    const result = keyToSymbol('control');
    expect(result).toBe('⌃');
  });

  it('meta returns ⌘', () => {
    const result = keyToSymbol('meta');
    expect(result).toEqual('⌘');
  });
  it('shift returns ⇧', () => {
    const result = keyToSymbol('shift');
    expect(result).toBe('⇧​');
  });
  it('enter returns an empty string', () => {
    const result = keyToSymbol('Enter');
    expect(result).toBe('');
  });

  it("' ' returns SPACE", () => {
    const result = keyToSymbol(' ');
    expect(result).toEqual('SPACE');
  });
  it('escape returns esc', () => {
    const result = keyToSymbol('escape');
    expect(result).toEqual('');
  });
  it('ArrowUp returns ↑​​​', () => {
    const result = keyToSymbol('ArrowUp');
    expect(result).toBe('↑');
  });
  it('ArrowDown returns ↓​​​', () => {
    const result = keyToSymbol('ArrowDown');
    expect(result).toBe('↓');
  });
  it('ArrowLeft returns ←', () => {
    const result = keyToSymbol('ArrowLeft');
    expect(result).toBe('←');
  });

  it('ArrowRight returns →', () => {
    const result = keyToSymbol('ArrowRight');
    expect(result).toBe('→');
  });

  it('capitalizes a lowercase key', () => {
    const output = keyToSymbol('a');
    expect(output).toBe('A');
  });
});
