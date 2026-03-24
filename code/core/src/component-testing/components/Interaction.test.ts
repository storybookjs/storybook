// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import type { Call } from '../../instrumenter/types';
import { getInteractionLabel } from './Interaction';

const minimalCall = (overrides: Partial<Call> & Pick<Call, 'method' | 'args'>): Call => ({
  id: 'call-id',
  cursor: 0,
  storyId: 'story--id',
  ancestors: [],
  path: [],
  interceptable: true,
  retain: false,
  ...overrides,
});

describe('getInteractionLabel', () => {
  it('uses the first string arg for a top-level step call', () => {
    expect(
      getInteractionLabel(
        minimalCall({
          method: 'step',
          args: ['Click button', { __function__: { name: '' } }],
        })
      )
    ).toBe('Click button');
  });

  it('trims whitespace from the step label', () => {
    expect(
      getInteractionLabel(
        minimalCall({
          method: 'step',
          args: ['  My step  '],
        })
      )
    ).toBe('My step');
  });

  it('falls back to method when the step label is empty after trim', () => {
    expect(
      getInteractionLabel(
        minimalCall({
          method: 'step',
          args: ['   '],
        })
      )
    ).toBe('step');
  });

  it('falls back to method when the step is nested (non-empty path)', () => {
    expect(
      getInteractionLabel(
        minimalCall({
          method: 'step',
          path: [{ __callId__: 'parent' }],
          args: ['Should be ignored'],
        })
      )
    ).toBe('step');
  });

  it('falls back to method when the first arg is not a string', () => {
    expect(
      getInteractionLabel(
        minimalCall({
          method: 'step',
          args: [{ __function__: { name: 'fn' } }],
        })
      )
    ).toBe('step');
  });

  it('uses method for non-step calls', () => {
    expect(
      getInteractionLabel(
        minimalCall({
          method: 'click',
          args: [],
        })
      )
    ).toBe('click');
  });
});
