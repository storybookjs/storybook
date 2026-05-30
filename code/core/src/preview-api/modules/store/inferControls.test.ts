import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';
import type { StoryContextForEnhancers } from 'storybook/internal/types';

import { argTypesEnhancers } from './inferControls.ts';

const getStoryContext = (overrides: any = {}): StoryContextForEnhancers => ({
  id: '',
  title: '',
  kind: '',
  name: '',
  story: '',
  initialArgs: {},
  argTypes: {
    label: { control: 'text' },
    labelName: { control: 'text' },
    borderWidth: { control: { type: 'number', min: 0, max: 10 } },
  },
  ...overrides,
  parameters: {
    __isArgsStory: true,
    ...overrides.parameters,
  },
});

const [inferControls] = argTypesEnhancers;
describe('inferControls', () => {
  describe('with custom matchers', () => {
    let warnSpy: MockInstance;
    beforeEach(() => {
      warnSpy = vi.spyOn(logger, 'warn');
      warnSpy.mockImplementation(() => {});
    });
    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should return color type when using color matcher', () => {
      // passing a string, should return control type color
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            background: {
              type: {
                name: 'string',
              },
              name: 'background',
            },
          },
          parameters: {
            controls: {
              matchers: {
                color: /background/,
              },
            },
          },
        })
      );

      const control = inferredControls.background.control;
      expect(typeof control === 'object' && control.type).toEqual('color');
    });

    it('should return inferred type when using color matcher but arg passed is not a string', () => {
      const sampleTypes = [
        {
          name: 'object',
          value: {
            rgb: {
              name: 'number',
            },
          },
        },
        { name: 'number' },
        { name: 'boolean' },
      ];

      sampleTypes.forEach((type) => {
        const inferredControls = inferControls(
          getStoryContext({
            argTypes: {
              background: {
                // passing an object which is unsupported
                // should ignore color control and infer the type instead
                type,
                name: 'background',
              },
            },
            parameters: {
              controls: {
                matchers: {
                  color: /background/,
                },
              },
            },
          })
        );

        expect(warnSpy).toHaveBeenCalled();
        const control = inferredControls.background.control;
        expect(typeof control === 'object' && control.type).toEqual(type.name);
      });
    });
  });

  it('should return argTypes as is when no exclude or include is passed', () => {
    const controls = inferControls(getStoryContext());
    expect(Object.keys(controls)).toEqual(['label', 'labelName', 'borderWidth']);
  });

  it('should return filtered argTypes when include is passed', () => {
    const [includeString, includeArray, includeRegex] = [
      inferControls(getStoryContext({ parameters: { controls: { include: 'label' } } })),
      inferControls(getStoryContext({ parameters: { controls: { include: ['label'] } } })),
      inferControls(getStoryContext({ parameters: { controls: { include: /label*/ } } })),
    ];

    expect(Object.keys(includeString)).toEqual(['label', 'labelName']);
    expect(Object.keys(includeArray)).toEqual(['label']);
    expect(Object.keys(includeRegex)).toEqual(['label', 'labelName']);
  });

  it('should return filtered argTypes when exclude is passed', () => {
    const [excludeString, excludeArray, excludeRegex] = [
      inferControls(getStoryContext({ parameters: { controls: { exclude: 'label' } } })),
      inferControls(getStoryContext({ parameters: { controls: { exclude: ['label'] } } })),
      inferControls(getStoryContext({ parameters: { controls: { exclude: /label*/ } } })),
    ];

    expect(Object.keys(excludeString)).toEqual(['borderWidth']);
    expect(Object.keys(excludeArray)).toEqual(['labelName', 'borderWidth']);
    expect(Object.keys(excludeRegex)).toEqual(['borderWidth']);
  });

  describe('with options property', () => {
    it('should infer select control when options are provided on a string type', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            variant: {
              type: { name: 'string' },
              options: ['primary', 'secondary', 'danger', 'warning', 'info', 'light'],
            },
          },
        })
      );

      const control = inferredControls.variant.control;
      expect(control.type).toEqual('select');
    });

    it('should infer radio control when 5 or fewer options are provided', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            size: {
              type: { name: 'string' },
              options: ['small', 'medium', 'large'],
            },
          },
        })
      );

      const control = inferredControls.size.control;
      expect(control.type).toEqual('radio');
    });

    it('should infer select control when more than 5 options are provided', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            color: {
              type: { name: 'string' },
              options: ['red', 'blue', 'green', 'yellow', 'purple', 'orange'],
            },
          },
        })
      );

      const control = inferredControls.color.control;
      expect(control.type).toEqual('select');
    });

    it('should infer select control when options are provided on a number type', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            count: {
              type: { name: 'number' },
              options: [1, 2, 3, 4, 5, 6],
            },
          },
        })
      );

      const control = inferredControls.count.control;
      expect(control.type).toEqual('select');
    });

    it('should NOT override explicit control type even when options are provided', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            variant: {
              type: { name: 'string' },
              options: ['primary', 'secondary'],
              control: { type: 'select' },
            },
          },
        })
      );

      // The explicit control should be preserved via combineParameters
      expect(inferredControls.variant.control.type).toEqual('select');
    });

    it('should NOT infer a control when options are provided without an explicit type', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            variant: {
              options: ['primary', 'secondary', 'danger', 'warning', 'info', 'light'],
            },
          },
        })
      );

      // Without type, inferControl returns undefined (early bail)
      // so options-only argTypes won't get inferred controls
      expect(inferredControls.variant.control).toBeUndefined();
    });
  });
});
