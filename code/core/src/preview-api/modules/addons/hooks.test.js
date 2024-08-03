import { describe, beforeEach, afterEach, expect, it } from 'vitest';
import { useParameter, useStoryContext } from './hooks';

describe('addons/hooks', () => {
  beforeEach(() => {
    global.STORYBOOK_HOOKS_CONTEXT = undefined;
  });

  afterEach(() => {
    global.STORYBOOK_HOOKS_CONTEXT = undefined;
  });

  describe('useStoryContext', () => {
    it('should throw', () => {
      expect(() => useStoryContext()).toThrowError(
        'Storybook preview hooks can only be called inside decorators and story functions.'
      );
    });
  });

  describe('useParameter', () => {
    beforeEach(() => {
      global.STORYBOOK_HOOKS_CONTEXT = {
        currentContext: {
          parameters: {
            'undefined key': undefined,
            'null key': null,
            'false key': false,
            'zero key': 0,
            'object key': { defined: true },
          },
        },
      };
    });

    it('undefined key', () => {
      expect(useParameter('undefined key', 'undefined default')).toEqual('undefined default');
    });

    it('null key', () => {
      expect(useParameter('null key', 'null default')).toEqual('null default');
    });

    it('false key', () => {
      expect(useParameter('false key', 'false default')).toEqual(false);
    });

    it('zero key', () => {
      expect(useParameter('zero key', 'zero default')).toEqual(0);
    });

    it('object key', () => {
      expect(useParameter('object key', 'object default')).toMatchObject({ defined: true });
    });
  });
});
