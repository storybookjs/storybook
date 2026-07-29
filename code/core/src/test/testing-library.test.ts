// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { getConfig } from './testing-library.ts';

describe('getElementError', () => {
  it('truncates long DOM dumps and points at screen.debug()', () => {
    const container = document.createElement('div');
    for (let i = 0; i < 100; i += 1) {
      const child = document.createElement('span');
      child.textContent = `item ${i}`;
      container.appendChild(child);
    }

    const error = getConfig().getElementError('Unable to find an element', container);

    expect(error.name).toBe('TestingLibraryElementError');
    expect(error.message).toContain('Unable to find an element');
    expect(error.message).toContain('use screen.debug() to see the full DOM');
    expect(error.message.split('\n').length).toBeLessThan(30);
  });

  it('leaves short DOM dumps intact', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = 'Click me';
    container.appendChild(button);

    const error = getConfig().getElementError('Unable to find an element', container);

    expect(error.message).toContain('Click me');
    expect(error.message).not.toContain('truncated');
  });

  it('returns the message alone when there is no container', () => {
    const error = getConfig().getElementError('Unable to find an element', undefined as never);

    expect(error.message).toBe('Unable to find an element');
  });
});
