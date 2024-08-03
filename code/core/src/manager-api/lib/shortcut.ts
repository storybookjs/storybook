import { global } from '@storybook/global';
import type { API_KeyCollection } from '../modules/shortcuts';

const { navigator } = global;

export const isMacLike = () =>
  navigator && navigator.platform ? !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) : false;
export const controlOrMetaSymbol = () => (isMacLike() ? '⌘' : 'ctrl');
export const controlOrMetaKey = () => (isMacLike() ? 'meta' : 'control');
export const optionOrAltSymbol = () => (isMacLike() ? '⌥' : 'alt');

export const isShortcutTaken = (arr1: string[], arr2: string[]): boolean =>
  JSON.stringify(arr1) === JSON.stringify(arr2);

// A subset of `KeyboardEvent` that's serialized over the channel, see `PreviewWeb.tsx`
export type KeyboardEventLike = Pick<
  KeyboardEvent,
  'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key' | 'code' | 'keyCode' | 'preventDefault'
>;

// Map a keyboard event to a keyboard shortcut
// NOTE: if we change the fields on the event that we need, we'll need to update the serialization in core/preview/start.js
export const eventToShortcut = (e: KeyboardEventLike): (string | string[])[] | null => {
  // Meta key only doesn't map to a shortcut
  if (['Meta', 'Alt', 'Control', 'Shift'].includes(e.key)) {
    return null;
  }

  const keys = [];
  if (e.altKey) {
    keys.push('alt');
  }
  if (e.ctrlKey) {
    keys.push('control');
  }
  if (e.metaKey) {
    keys.push('meta');
  }
  if (e.shiftKey) {
    keys.push('shift');
  }

  if (e.key && e.key.length === 1 && e.key !== ' ') {
    const key = e.key.toUpperCase();
    // Using `event.code` to support `alt (option) + <key>` on macos which returns special characters
    // See full list of event.code here:
    // https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
    const code = e.code?.toUpperCase().replace('KEY', '').replace('DIGIT', '');

    if (code && code.length === 1 && code !== key) {
      keys.push([key, code]);
    } else {
      keys.push(key);
    }
  }
  if (e.key === ' ') {
    keys.push('space');
  }
  if (e.key === 'Escape') {
    keys.push('escape');
  }
  if (e.key === 'ArrowRight') {
    keys.push('ArrowRight');
  }
  if (e.key === 'ArrowDown') {
    keys.push('ArrowDown');
  }
  if (e.key === 'ArrowUp') {
    keys.push('ArrowUp');
  }
  if (e.key === 'ArrowLeft') {
    keys.push('ArrowLeft');
  }

  return keys.length > 0 ? keys : null;
};

export const shortcutMatchesShortcut = (
  inputShortcut: (string | string[])[],
  shortcut: API_KeyCollection
): boolean => {
  if (!inputShortcut || !shortcut) return false;
  if (inputShortcut.join('').startsWith('shift/')) inputShortcut.shift(); // shift is optional for `/`
  if (inputShortcut.length !== shortcut.length) return false;
  return !inputShortcut.find((input, i) =>
    Array.isArray(input) ? !input.includes(shortcut[i]) : input !== shortcut[i]
  );
};

// Should this keyboard event trigger this keyboard shortcut?
export const eventMatchesShortcut = (
  e: KeyboardEventLike,
  shortcut: API_KeyCollection
): boolean => {
  return shortcutMatchesShortcut(eventToShortcut(e)!, shortcut);
};

export const keyToSymbol = (key: string): string => {
  if (key === 'alt') {
    return optionOrAltSymbol();
  }
  if (key === 'control') {
    return '⌃';
  }
  if (key === 'meta') {
    return '⌘';
  }
  if (key === 'shift') {
    return '⇧​';
  }
  if (key === 'Enter' || key === 'Backspace' || key === 'Esc') {
    return '';
  }
  if (key === 'escape') {
    return '';
  }
  if (key === ' ') {
    return 'SPACE';
  }
  if (key === 'ArrowUp') {
    return '↑';
  }
  if (key === 'ArrowDown') {
    return '↓';
  }
  if (key === 'ArrowLeft') {
    return '←';
  }
  if (key === 'ArrowRight') {
    return '→';
  }
  return key.toUpperCase();
};

// Display the shortcut as a human readable string
export const shortcutToHumanString = (shortcut: API_KeyCollection): string => {
  return shortcut.map(keyToSymbol).join(' ');
};
