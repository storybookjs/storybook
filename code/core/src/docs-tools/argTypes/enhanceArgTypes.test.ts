import { describe, it, expect } from 'vitest';
import type { ArgTypes, StrictInputType } from '@storybook/core/types';
import { enhanceArgTypes } from './enhanceArgTypes';

expect.addSnapshotSerializer({
  print: (val: any) => JSON.stringify(val, null, 2),
  test: (val) => typeof val !== 'string',
});

const enhance = ({
  argType,
  arg,
  extractedArgTypes,
  isArgsStory = true,
}: {
  argType?: StrictInputType;
  arg?: any;
  extractedArgTypes?: ArgTypes;
  isArgsStory?: boolean;
}) => {
  const context = {
    componentId: 'foo',
    title: 'foo',
    kind: 'foo',
    id: 'foo--bar',
    name: 'bar',
    story: 'bar',
    component: 'dummy',
    parameters: {
      __isArgsStory: isArgsStory,
      docs: {
        extractArgTypes: extractedArgTypes && (() => extractedArgTypes),
      },
    },
    argTypes: argType && { input: argType },
    initialArgs: { input: arg },
    args: { input: arg },
    globals: {},
  };
  // @ts-expect-error (not strict)
  return enhanceArgTypes(context);
};

describe('enhanceArgTypes', () => {
  describe('no-args story function', () => {
    it('should no-op', () => {
      expect(
        enhance({
          argType: { name: 'input', foo: 'unmodified', type: { name: 'number' } },
          isArgsStory: false,
        }).input
      ).toMatchInlineSnapshot(`
        {
          "name": "input",
          "foo": "unmodified",
          "type": {
            "name": "number"
          }
        }
      `);
    });
  });
  describe('args story function', () => {
    describe('single-source input', () => {
      describe('argTypes input', () => {
        it('number', () => {
          expect(
            enhance({
              argType: { name: 'input', type: { name: 'number' } },
            }).input
          ).toMatchInlineSnapshot(`
            {
              "name": "input",
              "type": {
                "name": "number"
              }
            }
          `);
        });
      });

      describe('extraction from component', () => {
        it('number', () => {
          expect(
            enhance({ extractedArgTypes: { input: { name: 'input', type: { name: 'number' } } } })
              .input
          ).toMatchInlineSnapshot(`
            {
              "name": "input",
              "type": {
                "name": "number"
              }
            }
          `);
        });
      });

      describe('controls input', () => {
        it('range', () => {
          expect(
            enhance({
              argType: { name: 'input', control: { type: 'range', min: 0, max: 100 } },
            }).input
          ).toMatchInlineSnapshot(`
            {
              "name": "input",
              "control": {
                "type": "range",
                "min": 0,
                "max": 100
              }
            }
          `);
        });
        it('options', () => {
          expect(
            enhance({
              argType: { name: 'input', control: { type: 'radio', options: [1, 2] } },
            }).input
          ).toMatchInlineSnapshot(`
            {
              "name": "input",
              "control": {
                "type": "radio",
                "options": [
                  1,
                  2
                ]
              }
            }
          `);
        });
      });
    });

    describe('mixed-source input', () => {
      it('user-specified argTypes take precedence over extracted argTypes', () => {
        expect(
          enhance({
            argType: { name: 'input', type: { name: 'number' } },
            extractedArgTypes: { input: { type: { name: 'string' } } },
          }).input
        ).toMatchInlineSnapshot(`
          {
            "type": {
              "name": "number"
            },
            "name": "input"
          }
        `);
      });

      it('user-specified argTypes take precedence over inferred argTypes', () => {
        expect(
          enhance({
            argType: { name: 'input', type: { name: 'number' } },
            arg: 'hello',
          }).input
        ).toMatchInlineSnapshot(`
          {
            "name": "input",
            "type": {
              "name": "number"
            }
          }
        `);
      });

      it('extracted argTypes take precedence over inferred argTypes', () => {
        expect(
          enhance({
            extractedArgTypes: { input: { type: { name: 'string' } } },
            arg: 6,
          }).input
        ).toMatchInlineSnapshot(`
          {
            "type": {
              "name": "string"
            }
          }
        `);
      });

      it('user-specified controls take precedence over inferred controls', () => {
        expect(
          enhance({
            argType: { name: 'input', defaultValue: 5, control: { type: 'range', step: 50 } },
            arg: 3,
            extractedArgTypes: { input: { name: 'input' } },
          }).input
        ).toMatchInlineSnapshot(`
          {
            "name": "input",
            "defaultValue": 5,
            "control": {
              "type": "range",
              "step": 50
            }
          }
        `);
      });

      it('includes extracted argTypes when there are no user-specified argTypes', () => {
        expect(
          enhance({
            arg: 3,
            extractedArgTypes: { input: { name: 'input' }, foo: { type: { name: 'number' } } },
          })
        ).toMatchInlineSnapshot(`
          {
            "input": {
              "name": "input"
            },
            "foo": {
              "type": {
                "name": "number"
              }
            }
          }
        `);
      });

      it('includes extracted argTypes when user-specified argTypes match', () => {
        expect(
          enhance({
            argType: { name: 'input', type: { name: 'number' } },
            extractedArgTypes: { input: { name: 'input' }, foo: { type: { name: 'number' } } },
          })
        ).toMatchInlineSnapshot(`
          {
            "input": {
              "name": "input",
              "type": {
                "name": "number"
              }
            },
            "foo": {
              "type": {
                "name": "number"
              }
            }
          }
        `);
      });

      it('excludes extracted argTypes when user-specified argTypes do not match', () => {
        expect(
          enhance({
            argType: { name: 'input', type: { name: 'number' } },
            extractedArgTypes: { foo: { type: { name: 'number' } } },
          })
        ).toMatchInlineSnapshot(`
          {
            "foo": {
              "type": {
                "name": "number"
              }
            },
            "input": {
              "name": "input",
              "type": {
                "name": "number"
              }
            }
          }
        `);
      });
    });
  });
});
