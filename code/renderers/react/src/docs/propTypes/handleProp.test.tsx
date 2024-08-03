/* eslint-disable no-underscore-dangle */

import { describe, it, expect } from 'vitest';
import PropTypes from 'prop-types';
import React from 'react';
import {
  type PropDef,
  extractComponentProps,
  type DocgenInfo,
  type DocgenPropDefaultValue,
} from 'storybook/internal/docs-tools';
import { enhancePropTypesProp, enhancePropTypesProps } from './handleProp';

type Component = any;
const DOCGEN_SECTION = 'props';

function ReactComponent() {
  return <div>React Component!</div>;
}

function createDocgenSection(docgenInfo: DocgenInfo): Record<string, any> {
  return {
    [DOCGEN_SECTION]: {
      ...docgenInfo,
    },
  };
}

function createDocgenProp({
  name,
  type,
  ...others
}: Partial<DocgenInfo> & { name: string }): Record<string, any> {
  return {
    [name]: {
      type,
      required: false,
      ...others,
    },
  };
}

function createComponent({ propTypes = {}, defaultProps = {}, docgenInfo = {} }): Component {
  const component = () => {
    return <div>Hey!</div>;
  };
  component.propTypes = propTypes;
  component.defaultProps = defaultProps;

  // @ts-expect-error (Converted from ts-ignore)
  component.__docgenInfo = createDocgenSection(docgenInfo);

  return component;
}

function createDefaultValue(defaultValue: string): DocgenPropDefaultValue {
  return { value: defaultValue };
}

function extractPropDef(component: Component, rawDefaultProp?: any): PropDef {
  return enhancePropTypesProp(extractComponentProps(component, DOCGEN_SECTION)[0], rawDefaultProp);
}

describe('enhancePropTypesProp', () => {
  describe('type', () => {
    function createTestComponent(docgenInfo: Partial<DocgenInfo>): Component {
      return createComponent({
        docgenInfo: {
          ...createDocgenProp({ name: 'prop', ...docgenInfo }),
        },
      });
    }

    describe('custom', () => {
      describe('when raw value is available', () => {
        it('should support literal', () => {
          const component = createTestComponent({
            type: {
              name: 'custom',
              raw: 'MY_LITERAL',
            },
          });

          const { type } = extractPropDef(component);

          expect(type?.summary).toBe('MY_LITERAL');
          expect(type?.detail).toBeUndefined();
        });

        it('should support short object', () => {
          const component = createTestComponent({
            type: {
              name: 'custom',
              raw: '{\n  text: PropTypes.string.isRequired,\n}',
            },
          });

          const { type } = extractPropDef(component);

          const expectedSummary = '{ text: string }';

          expect(type?.summary?.replace(/\s/g, '')).toBe(expectedSummary.replace(/\s/g, ''));
          expect(type?.detail).toBeUndefined();
        });

        it('should support long object', () => {
          const component = createTestComponent({
            type: {
              name: 'custom',
              raw: '{\n  text: PropTypes.string.isRequired,\n  value1: PropTypes.string.isRequired,\n  value2: PropTypes.string.isRequired,\n  value3: PropTypes.string.isRequired,\n  value4: PropTypes.string.isRequired,\n}',
            },
          });

          const { type } = extractPropDef(component);

          expect(type?.summary).toBe('object');

          const expectedDetail = `{
            text: string,
            value1: string,
            value2: string,
            value3: string,
            value4: string
          }`;

          expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
        });

        it('should not have a deep object as summary', () => {
          const component = createTestComponent({
            type: {
              name: 'custom',
              raw: '{\n  foo: { bar: PropTypes.string.isRequired,\n  }}',
            },
          });

          const { type } = extractPropDef(component);

          expect(type?.summary).toBe('object');
        });

        it('should use identifier of a React element when available', () => {
          const component = createTestComponent({
            type: {
              name: 'custom',
              raw: 'function InlinedFunctionalComponent() {\n  return <div>Inlined FunctionalComponent!</div>;\n}',
            },
          });

          const { type } = extractPropDef(component);

          expect(type?.summary).toBe('InlinedFunctionalComponent');

          const expectedDetail = `function InlinedFunctionalComponent() {
            return <div>Inlined FunctionalComponent!</div>;
          }`;

          expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
        });

        it('should not use identifier of a HTML element', () => {
          const component = createTestComponent({
            type: {
              name: 'custom',
              raw: '<div>Hello world from Montreal, Quebec, Canada!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!</div>',
            },
          });

          const { type } = extractPropDef(component);

          expect(type?.summary).toBe('element');

          const expectedDetail =
            '<div>Hello world from Montreal, Quebec, Canada!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!</div>';

          expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
        });

        it('should support element without identifier', () => {
          const component = createTestComponent({
            type: {
              name: 'custom',
              raw: '() => {\n  return <div>Inlined FunctionalComponent!</div>;\n}',
            },
          });

          const { type } = extractPropDef(component);

          expect(type?.summary).toBe('element');

          const expectedDetail = `() => {
              return <div>Inlined FunctionalComponent!</div>;
            }`;

          expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
        });

        describe('when it is not a known type', () => {
          it('should return "custom" when its a long type', () => {
            const component = createTestComponent({
              type: {
                name: 'custom',
                raw: 'Symbol("A very very very very very very lonnnngggggggggggggggggggggggggggggggggggg symbol")',
              },
            });

            const { type } = extractPropDef(component);

            expect(type?.summary).toBe('custom');
            expect(type?.detail).toBe(
              'Symbol("A very very very very very very lonnnngggggggggggggggggggggggggggggggggggg symbol")'
            );
          });

          it('should return "custom" when its a short type', () => {
            const component = createTestComponent({
              type: {
                name: 'custom',
                raw: 'Symbol("Hey!")',
              },
            });

            const { type } = extractPropDef(component);

            expect(type?.summary).toBe('Symbol("Hey!")');
            expect(type?.detail).toBeUndefined();
          });
        });
      });

      it("should return 'custom' when there is no raw value", () => {
        const component = createTestComponent({
          type: {
            name: 'custom',
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('custom');
      });
    });

    [
      'any',
      'bool',
      'string',
      'number',
      'symbol',
      'object',
      'element',
      'elementType',
      'node',
    ].forEach((x) => {
      it(`should return '${x}' when type is ${x}`, () => {
        const component = createTestComponent({
          type: {
            name: x,
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe(x);
      });
    });

    it('should support short shape', () => {
      const component = createTestComponent({
        type: {
          name: 'shape',
          value: {
            foo: {
              name: 'string',
              required: false,
            },
          },
        },
      });

      const { type } = extractPropDef(component);

      const expectedSummary = '{ foo: string }';

      expect(type?.summary?.replace(/\s/g, '')).toBe(expectedSummary.replace(/\s/g, ''));
      expect(type?.detail).toBeUndefined();
    });

    it('should support long shape', () => {
      const component = createTestComponent({
        type: {
          name: 'shape',
          value: {
            foo: {
              name: 'string',
              required: false,
            },
            bar: {
              name: 'string',
              required: false,
            },
            another: {
              name: 'string',
              required: false,
            },
            another2: {
              name: 'string',
              required: false,
            },
            another3: {
              name: 'string',
              required: false,
            },
            another4: {
              name: 'string',
              required: false,
            },
          },
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('object');

      const expectedDetail = `{
        foo: string,
        bar: string,
        another: string,
        another2: string,
        another3: string,
        another4: string
      }`;

      expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should not have a deep shape as summary', () => {
      const component = createTestComponent({
        type: {
          name: 'shape',
          value: {
            bar: {
              name: 'shape',
              value: {
                hey: {
                  name: 'string',
                  required: false,
                },
              },
              required: false,
            },
          },
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('object');
    });

    it('should support enum of string', () => {
      const component = createTestComponent({
        type: {
          name: 'enum',
          value: [
            {
              value: "'News'",
              computed: false,
            },
            {
              value: "'Photos'",
              computed: false,
            },
          ],
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe("'News' | 'Photos'");
    });

    it('should support enum of object', () => {
      const component = createTestComponent({
        type: {
          name: 'enum',
          value: [
            {
              value:
                '{\n  text: PropTypes.string.isRequired,\n  value: PropTypes.string.isRequired,\n}',
              computed: true,
            },
            {
              value:
                '{\n  foo: PropTypes.string,\n  bar: PropTypes.string,\n  hey: PropTypes.string,\n  ho: PropTypes.string,\n}',
              computed: true,
            },
          ],
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('object | object');

      const expectedDetail = `{
          text: string,
          value: string
        } | {
          foo: string,
          bar: string,
          hey: string,
          ho: string
        }`;

      expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should support short object in enum summary', () => {
      const component = createTestComponent({
        type: {
          name: 'enum',
          value: [
            {
              value: '{\n  text: PropTypes.string.isRequired,\n}',
              computed: true,
            },
            {
              value: '{\n  foo: PropTypes.string,\n}',
              computed: true,
            },
          ],
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('{ text: string } | { foo: string }');
    });

    it('should not have a deep object in an enum summary', () => {
      const component = createTestComponent({
        type: {
          name: 'enum',
          value: [
            {
              value: '{\n  text: { foo: PropTypes.string.isRequired,\n }\n}',
              computed: true,
            },
            {
              value: '{\n  foo: PropTypes.string,\n}',
              computed: true,
            },
          ],
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('object | object');
    });

    it('should support enum of element', () => {
      const component = createTestComponent({
        type: {
          name: 'enum',
          value: [
            {
              value: '() => {\n  return <div>FunctionalComponent!</div>;\n}',
              computed: true,
            },
            {
              value:
                'class ClassComponent extends React.PureComponent {\n  render() {\n    return <div>ClassComponent!</div>;\n  }\n}',
              computed: true,
            },
          ],
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('element | ClassComponent');

      const expectedDetail = `() => {
          return <div>FunctionalComponent!</div>;
        } | class ClassComponent extends React.PureComponent {
          render() {
            return <div>ClassComponent!</div>;
          }
        }`;

      expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    describe('func', () => {
      it('should return "func" when the prop dont have a description', () => {
        const component = createTestComponent({
          type: {
            name: 'func',
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('func');
      });

      it('should return "func" when the prop have a description without JSDoc tags', () => {
        const component = createTestComponent({
          type: {
            name: 'func',
          },
          description: 'Hey! Hey!',
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('func');
      });

      it('should return a func signature when there is JSDoc tags.', () => {
        const component = createTestComponent({
          type: {
            name: 'func',
          },
          description: '@param event\n@param data\n@returns {string}',
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('(event, data) => string');
      });
    });

    it('should return the instance type when type is instanceOf', () => {
      const component = createTestComponent({
        type: {
          name: 'instanceOf',
          value: 'Set',
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('Set');
    });

    describe('objectOf', () => {
      it('should support objectOf primitive', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'number',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf(number)');
        expect(type?.detail).toBeUndefined();
      });

      it('should support objectOf of identifier', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'custom',
              raw: 'NAMED_OBJECT',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf(NAMED_OBJECT)');
        expect(type?.detail).toBeUndefined();
      });

      it('should support objectOf short object', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'custom',
              raw: '{\n  foo: PropTypes.string,\n}',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf({ foo: string })');
        expect(type?.detail).toBeUndefined();
      });

      it('should support objectOf long object', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'custom',
              raw: '{\n  foo: PropTypes.string,\n  bar: PropTypes.string,\n  another: PropTypes.string,\n  anotherAnother: PropTypes.string,\n}',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf(object)');

        const expectedDetail = `objectOf({
          foo: string,
          bar: string,
          another: string,
          anotherAnother: string
        })`;

        expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
      });

      it('should not have deep object in summary', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'custom',
              raw: '{\n  foo: { bar: PropTypes.string,\n }\n}',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf(object)');
      });

      it('should support objectOf short shape', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'shape',
              value: {
                foo: {
                  name: 'string',
                  required: false,
                },
              },
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf({ foo: string })');
        expect(type?.detail).toBeUndefined();
      });

      it('should support objectOf long shape', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'shape',
              value: {
                foo: {
                  name: 'string',
                  required: false,
                },
                bar: {
                  name: 'string',
                  required: false,
                },
                another: {
                  name: 'string',
                  required: false,
                },
                anotherAnother: {
                  name: 'string',
                  required: false,
                },
              },
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf(object)');

        const expectedDetail = `objectOf({
          foo: string,
          bar: string,
          another: string,
          anotherAnother: string
        })`;

        expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
      });

      it('should not have a deep shape in summary', () => {
        const component = createTestComponent({
          type: {
            name: 'objectOf',
            value: {
              name: 'shape',
              value: {
                bar: {
                  name: 'shape',
                  value: {
                    hey: {
                      name: 'string',
                      required: false,
                    },
                  },
                  required: false,
                },
              },
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('objectOf(object)');
      });
    });

    it('should support union', () => {
      const component = createTestComponent({
        type: {
          name: 'union',
          value: [
            {
              name: 'string',
            },
            {
              name: 'instanceOf',
              value: 'Set',
            },
          ],
        },
      });

      const { type } = extractPropDef(component);

      expect(type?.summary).toBe('string | Set');
      expect(type?.detail).toBeUndefined();
    });

    describe('array', () => {
      it('should support array of primitive', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'number',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('number[]');
        expect(type?.detail).toBeUndefined();
      });

      it('should support array of identifier', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'custom',
              raw: 'NAMED_OBJECT',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('NAMED_OBJECT[]');
        expect(type?.detail).toBeUndefined();
      });

      it('should support array of short object', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'custom',
              raw: '{\n  foo: PropTypes.string,\n}',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('[{ foo: string }]');
        expect(type?.detail).toBeUndefined();
      });

      it('should support array of long object', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'custom',
              raw: '{\n  text: PropTypes.string.isRequired,\n  value: PropTypes.string.isRequired,\n  another: PropTypes.string.isRequired,\n  another2: PropTypes.string.isRequired,\n  another3: PropTypes.string.isRequired,\n  another4: PropTypes.string.isRequired,\n}',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('object[]');

        const expectedDetail = `[{
          text: string,
          value: string,
          another: string,
          another2: string,
          another3: string,
          another4: string
        }]`;

        expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
      });

      it('should not have deep object in summary', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'custom',
              raw: '{\n  foo: { bar: PropTypes.string, }\n}',
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('object[]');
      });

      it('should support array of short shape', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'shape',
              value: {
                foo: {
                  name: 'string',
                  required: false,
                },
              },
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('[{ foo: string }]');
        expect(type?.detail).toBeUndefined();
      });

      it('should support array of long shape', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'shape',
              value: {
                foo: {
                  name: 'string',
                  required: false,
                },
                bar: {
                  name: 'string',
                  required: false,
                },
                another: {
                  name: 'string',
                  required: false,
                },
                another2: {
                  name: 'string',
                  required: false,
                },
                another3: {
                  name: 'string',
                  required: false,
                },
                another4: {
                  name: 'string',
                  required: false,
                },
              },
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('object[]');

        const expectedDetail = `[{
          foo: string,
          bar: string,
          another: string,
          another2: string,
          another3: string,
          another4: string
        }]`;

        expect(type?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
      });

      it('should not have deep shape in summary', () => {
        const component = createTestComponent({
          type: {
            name: 'arrayOf',
            value: {
              name: 'shape',
              value: {
                bar: {
                  name: 'shape',
                  value: {
                    hey: {
                      name: 'string',
                      required: false,
                    },
                  },
                  required: false,
                },
              },
            },
          },
        });

        const { type } = extractPropDef(component);

        expect(type?.summary).toBe('object[]');
      });
    });
  });

  describe('defaultValue', () => {
    function createTestComponent(
      defaultValue: DocgenPropDefaultValue,
      typeName = 'anything-is-fine'
    ): Component {
      return createComponent({
        docgenInfo: {
          ...createDocgenProp({
            name: 'prop',
            type: { name: typeName },
            defaultValue,
          }),
        },
      });
    }

    it('should support short object', () => {
      const component = createTestComponent(createDefaultValue("{ foo: 'foo', bar: 'bar' }"));

      const { defaultValue } = extractPropDef(component);

      const expectedSummary = "{ foo: 'foo', bar: 'bar' }";

      expect(defaultValue?.summary?.replace(/\s/g, '')).toBe(expectedSummary.replace(/\s/g, ''));
      expect(defaultValue?.detail).toBeUndefined();
    });

    it('should support long object', () => {
      const component = createTestComponent(
        createDefaultValue("{ foo: 'foo', bar: 'bar', another: 'another' }")
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('object');

      const expectedDetail = `{
        foo: 'foo',
        bar: 'bar',
        another: 'another'
      }`;

      expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should not have deep object in summary', () => {
      const component = createTestComponent(
        createDefaultValue("{ foo: 'foo', bar: { hey: 'ho' } }")
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('object');
    });

    it('should support short function', () => {
      const component = createTestComponent(createDefaultValue('() => {}'));

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('() => {}');
      expect(defaultValue?.detail).toBeUndefined();
    });

    it('should support long function', () => {
      const component = createTestComponent(
        createDefaultValue(
          '(foo, bar) => {\n  const concat = foo + bar;\n  const append = concat + " hey!";\n  \n  return append;\n}'
        )
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('func');

      const expectedDetail = `(foo, bar) => {
        const concat = foo + bar;
        const append = concat + ' hey!';
        return append
      }`;

      expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should use the name of function when available and indicate that args are present', () => {
      const component = createTestComponent(
        createDefaultValue('function concat(a, b) {\n  return a + b;\n}')
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('concat( ... )');

      const expectedDetail = `function concat(a, b) {
        return a + b
      }`;

      expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should use the name of function when available', () => {
      const component = createTestComponent(
        createDefaultValue('function hello() {\n  return "hello";\n}')
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('hello()');

      const expectedDetail = `function hello() {
        return 'hello'
      }`;

      expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should support short element', () => {
      const component = createTestComponent(createDefaultValue('<div>Hey!</div>'));

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('<div>Hey!</div>');
      expect(defaultValue?.detail).toBeUndefined();
    });

    it('should support long element', () => {
      const component = createTestComponent(
        createDefaultValue(
          '<div>Hey! Hey! Hey!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!</div>'
        )
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('element');
      expect(defaultValue?.detail).toBe(
        '<div>Hey! Hey! Hey!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!</div>'
      );
    });

    it('should support element with props', () => {
      const component = createTestComponent(createDefaultValue('<Component className="toto" />'));

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('<Component />');
      expect(defaultValue?.detail).toBe('<Component className="toto" />');
    });

    it("should use the name of the React component when it's available", () => {
      const component = createTestComponent(
        createDefaultValue(
          'function InlinedFunctionalComponent() {\n  return <div>Inlined FunctionalComponent!</div>;\n}'
        )
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('<InlinedFunctionalComponent />');

      const expectedDetail = `function InlinedFunctionalComponent() {
        return <div>Inlined FunctionalComponent!</div>;
      }`;

      expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should not use the name of an HTML element', () => {
      const component = createTestComponent(createDefaultValue('<div>Hey!</div>'));

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).not.toBe('<div />');
    });

    it('should support short array', () => {
      const component = createTestComponent(createDefaultValue('[1]'));

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('[1]');
      expect(defaultValue?.detail).toBeUndefined();
    });

    it('should support long array', () => {
      const component = createTestComponent(
        createDefaultValue(
          '[\n  {\n    thing: {\n      id: 2,\n      func: () => {},\n      arr: [],\n    },\n  },\n]'
        )
      );

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('array');

      const expectedDetail = `[{
          thing: {
            id: 2,
            func: () => {
            },
            arr: []
          }
        }]`;

      expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
    });

    it('should not have deep array in summary', () => {
      const component = createTestComponent(createDefaultValue('[[[1]]]'));

      const { defaultValue } = extractPropDef(component);

      expect(defaultValue?.summary).toBe('array');
    });

    describe('fromRawDefaultProp', () => {
      [
        { type: 'number', defaultProp: 1 },
        { type: 'boolean', defaultProp: true },
        { type: 'symbol', defaultProp: Symbol('hey!') },
      ].forEach((x) => {
        it(`should support ${x.type}`, () => {
          // @ts-expect-error (invalid input)
          const component = createTestComponent(null);

          const { defaultValue } = extractPropDef(component, x.defaultProp);

          expect(defaultValue?.summary).toBe(x.defaultProp.toString());
          expect(defaultValue?.detail).toBeUndefined();
        });
      });

      it('should support strings', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, 'foo');

        expect(defaultValue?.summary).toBe('"foo"');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support array of primitives', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, [1, 2, 3]);

        expect(defaultValue?.summary).toBe('[1,    2,    3]');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support array of short object', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, [{ foo: 'bar' }]);

        expect(defaultValue?.summary).toBe("[{ 'foo': 'bar' }]");
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support array of long object', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, [{ foo: 'bar', bar: 'foo', hey: 'ho' }]);

        expect(defaultValue?.summary).toBe('array');

        const expectedDetail = `[{
          'foo': 'bar',
          'bar': 'foo',
          'hey': 'ho'
        }]`;

        expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
      });

      it('should support short object', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, { foo: 'bar' });

        expect(defaultValue?.summary).toBe("{ 'foo': 'bar' }");
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support long object', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, { foo: 'bar', bar: 'foo', hey: 'ho' });

        expect(defaultValue?.summary).toBe('object');

        const expectedDetail = `{
          'foo': 'bar',
          'bar': 'foo',
          'hey': 'ho'
        }`;

        expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
      });

      it('should support anonymous function', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, () => 'hey!');

        expect(defaultValue?.summary).toBe('func');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support named function', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, function hello() {
          return 'world!';
        });

        expect(defaultValue?.summary).toBe('hello()');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support named function with params', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, function add(a: number, b: number) {
          return a + b;
        });

        expect(defaultValue?.summary).toBe('add( ... )');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support React element', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const defaultProp = <ReactComponent />;
        // Simulate babel-plugin-add-react-displayname.
        defaultProp.type.displayName = 'ReactComponent';

        const { defaultValue } = extractPropDef(component, defaultProp);

        expect(defaultValue?.summary).toBe('<ReactComponent />');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support React element with props', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        // @ts-expect-error (Converted from ts-ignore)
        const defaultProp = <ReactComponent className="toto" />;
        // Simulate babel-plugin-add-react-displayname.
        defaultProp.type.displayName = 'ReactComponent';

        const { defaultValue } = extractPropDef(component, defaultProp);

        expect(defaultValue?.summary).toBe('<ReactComponent />');
        expect(defaultValue?.detail).toBe('<ReactComponent className="toto" />');
      });

      it('should support short HTML element', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(component, <div>HTML element</div>);

        expect(defaultValue?.summary).toBe('<div>HTML element</div>');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support long HTML element', () => {
        // @ts-expect-error (invalid input)
        const component = createTestComponent(null);

        const { defaultValue } = extractPropDef(
          component,
          <div>HTML element!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!</div>
        );

        expect(defaultValue?.summary).toBe('element');

        const expectedDetail = `<div>
          HTML element!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        </div>`;

        expect(defaultValue?.detail?.replace(/\s/g, '')).toBe(expectedDetail.replace(/\s/g, ''));
      });

      ['element', 'elementType'].forEach((x) => {
        it(`should support inlined React class component for ${x}`, () => {
          // @ts-expect-error (invalid input)
          const component = createTestComponent(null, x);

          const { defaultValue } = extractPropDef(
            component,
            class InlinedClassComponent extends React.PureComponent {
              render() {
                return <div>Inlined ClassComponent!</div>;
              }
            }
          );

          expect(defaultValue?.summary).toBe('<InlinedClassComponent />');
          expect(defaultValue?.detail).toBeUndefined();
        });

        it(`should support inlined anonymous React functional component for ${x}`, () => {
          // @ts-expect-error (invalid input)
          const component = createTestComponent(null, x);

          const { defaultValue } = extractPropDef(component, () => {
            return <div>Inlined FunctionalComponent!</div>;
          });

          expect(defaultValue?.summary).toBe('element');
          expect(defaultValue?.detail).toBeUndefined();
        });

        it(`should support inlined anonymous React functional component with props for ${x}`, () => {
          // @ts-expect-error (invalid input)
          const component = createTestComponent(null, x);

          const { defaultValue } = extractPropDef(component, ({ foo }: { foo: string }) => {
            return <div>{foo}</div>;
          });

          expect(defaultValue?.summary).toBe('element');
          expect(defaultValue?.detail).toBeUndefined();
        });

        it(`should support inlined named React functional component for ${x}`, () => {
          // @ts-expect-error (invalid input)
          const component = createTestComponent(null, x);

          const { defaultValue } = extractPropDef(component, function InlinedFunctionalComponent() {
            return <div>Inlined FunctionalComponent!</div>;
          });

          expect(defaultValue?.summary).toBe('<InlinedFunctionalComponent />');
          expect(defaultValue?.detail).toBeUndefined();
        });

        it(`should support inlined named React functional component with props for ${x}`, () => {
          // @ts-expect-error (invalid input)
          const component = createTestComponent(null, x);

          const { defaultValue } = extractPropDef(
            component,
            function InlinedFunctionalComponent({ foo }: { foo: string }) {
              return <div>{foo}</div>;
            }
          );

          expect(defaultValue?.summary).toBe('<InlinedFunctionalComponent />');
          expect(defaultValue?.detail).toBeUndefined();
        });
      });
    });
  });
});

describe('enhancePropTypesProps', () => {
  it('should keep the original definition order', () => {
    const component = createComponent({
      propTypes: {
        foo: PropTypes.string,
        middleWithDefaultValue: PropTypes.string,
        bar: PropTypes.string,
        endWithDefaultValue: PropTypes.string,
      },
      docgenInfo: {
        ...createDocgenProp({
          name: 'middleWithDefaultValue',
          type: { name: 'string' },
          defaultValue: { value: 'Middle!' },
        }),
        ...createDocgenProp({
          name: 'endWithDefaultValue',
          type: { name: 'string' },
          defaultValue: { value: 'End!' },
        }),
        ...createDocgenProp({
          name: 'foo',
          type: { name: 'string' },
        }),
        ...createDocgenProp({
          name: 'bar',
          type: { name: 'string' },
        }),
      },
    });

    const props = enhancePropTypesProps(
      extractComponentProps(component, DOCGEN_SECTION),
      component
    );

    expect(props.length).toBe(4);
    expect(props[0].name).toBe('foo');
    expect(props[1].name).toBe('middleWithDefaultValue');
    expect(props[2].name).toBe('bar');
    expect(props[3].name).toBe('endWithDefaultValue');
  });

  it('should not include @ignore props', () => {
    const component = createComponent({
      propTypes: {
        foo: PropTypes.string,
        bar: PropTypes.string,
      },
      docgenInfo: {
        ...createDocgenProp({
          name: 'foo',
          type: { name: 'string' },
        }),
        ...createDocgenProp({
          name: 'bar',
          type: { name: 'string' },
          description: '@ignore',
        }),
      },
    });

    const props = enhancePropTypesProps(
      extractComponentProps(component, DOCGEN_SECTION),
      component
    );

    expect(props.length).toBe(1);
    expect(props[0].name).toBe('foo');
  });
});
