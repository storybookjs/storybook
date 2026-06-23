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

  describe('large union types (keyof typeof with many keys)', () => {
    it('should infer select control when type has value array with >5 string literals', () => {
      // Simulates react-docgen-typescript misclassifying a large `keyof typeof` union
      // as a non-enum type (e.g. 'other') while still providing the value array
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            variant: {
              type: {
                name: 'other',
                value: [
                  'option1',
                  'option2',
                  'option3',
                  'option4',
                  'option5',
                  'option6',
                  'option7',
                  'option8',
                ],
              },
              name: 'variant',
            },
          },
        })
      );

      const control = inferredControls.variant.control;
      expect(typeof control === 'object' && control.type).toEqual('select');
      expect(inferredControls.variant.options).toEqual([
        'option1',
        'option2',
        'option3',
        'option4',
        'option5',
        'option6',
        'option7',
        'option8',
      ]);
    });

    it('should infer radio control when type has value array with <=5 string literals', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            size: {
              type: {
                name: 'other',
                value: ['sm', 'md', 'lg'],
              },
              name: 'size',
            },
          },
        })
      );

      const control = inferredControls.size.control;
      expect(typeof control === 'object' && control.type).toEqual('radio');
      expect(inferredControls.size.options).toEqual(['sm', 'md', 'lg']);
    });

    it('should fall back to object control when type has no value array', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            config: {
              type: {
                name: 'other',
              },
              name: 'config',
            },
          },
        })
      );

      const control = inferredControls.config.control;
      expect(typeof control === 'object' && control.type).toEqual('object');
    });

    it('should prefer explicit options over inferred value array', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            variant: {
              type: {
                name: 'other',
                value: ['a', 'b', 'c', 'd', 'e', 'f'],
              },
              options: ['x', 'y', 'z'],
              name: 'variant',
            },
          },
        })
      );

      const control = inferredControls.variant.control;
      expect(typeof control === 'object' && control.type).toEqual('select');
    });

    it('should not treat mixed-type value arrays as enums', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            config: {
              type: {
                name: 'other',
                value: ['string', 42, true, null],
              },
              name: 'config',
            },
          },
        })
      );

      const control = inferredControls.config.control;
      expect(typeof control === 'object' && control.type).toEqual('object');
    });

    it('should handle numeric value arrays correctly', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            columns: {
              type: {
                name: 'other',
                value: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
              },
              name: 'columns',
            },
          },
        })
      );

      const control = inferredControls.columns.control;
      expect(typeof control === 'object' && control.type).toEqual('select');
      expect(inferredControls.columns.options).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('should handle intersection type name with value array (29+ keys scenario)', () => {
      // This is the exact scenario from issue #12641 — keyof typeof with 29+ keys
      // causes react-docgen-typescript to report type.name as 'intersection'
      const manyKeys = Array.from({ length: 30 }, (_, i) => `key${i}`);
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            iconName: {
              type: {
                name: 'intersection',
                value: manyKeys,
              },
              name: 'iconName',
            },
          },
        })
      );

      const control = inferredControls.iconName.control;
      expect(typeof control === 'object' && control.type).toEqual('select');
      expect(inferredControls.iconName.options).toEqual(manyKeys);
      expect(inferredControls.iconName.options).toHaveLength(30);
    });

    it('should not infer enum from empty value arrays', () => {
      const inferredControls = inferControls(
        getStoryContext({
          argTypes: {
            empty: {
              type: {
                name: 'other',
                value: [],
              },
              name: 'empty',
            },
          },
        })
      );

      const control = inferredControls.empty.control;
      expect(typeof control === 'object' && control.type).toEqual('object');
    });
  });
});

