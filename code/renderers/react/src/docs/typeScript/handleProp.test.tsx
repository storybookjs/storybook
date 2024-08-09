/* eslint-disable no-underscore-dangle */
import { describe, expect, it } from 'vitest';

import React from 'react';

import {
  type DocgenInfo,
  type DocgenPropDefaultValue,
  type PropDef,
  extractComponentProps,
} from 'storybook/internal/docs-tools';

import { enhanceTypeScriptProp } from './handleProp';

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
  tsType,
  ...others
}: Partial<DocgenInfo> & { name: string }): Record<string, any> {
  return {
    [name]: {
      tsType,
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
  return enhanceTypeScriptProp(extractComponentProps(component, DOCGEN_SECTION)[0], rawDefaultProp);
}

describe('enhanceTypeScriptProp', () => {
  describe('defaultValue', () => {
    function createTestComponent(
      defaultValue: DocgenPropDefaultValue | undefined,
      typeName = 'anything-is-fine'
    ): Component {
      return createComponent({
        docgenInfo: {
          ...createDocgenProp({
            name: 'prop',
            tsType: { name: typeName },
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
          // @ts-expect-error (not strict)
          const component = createTestComponent(null);

          const { defaultValue } = extractPropDef(component, x.defaultProp);

          expect(defaultValue?.summary).toBe(x.defaultProp.toString());
          expect(defaultValue?.detail).toBeUndefined();
        });
      });

      it('should support strings', () => {
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, 'foo');

        expect(defaultValue?.summary).toBe('"foo"');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support array of primitives', () => {
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, [1, 2, 3]);

        expect(defaultValue?.summary).toBe('[1,    2,    3]');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support array of short object', () => {
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, [{ foo: 'bar' }]);

        expect(defaultValue?.summary).toBe("[{ 'foo': 'bar' }]");
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support array of long object', () => {
        const component = createTestComponent(undefined);

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
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, { foo: 'bar' });

        expect(defaultValue?.summary).toBe("{ 'foo': 'bar' }");
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support long object', () => {
        const component = createTestComponent(undefined);

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
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, () => 'hey!');

        expect(defaultValue?.summary).toBe('func');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support named function', () => {
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, function hello() {
          return 'world!';
        });

        expect(defaultValue?.summary).toBe('hello()');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support named function with params', () => {
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, function add(a: number, b: number) {
          return a + b;
        });

        expect(defaultValue?.summary).toBe('add( ... )');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support React element', () => {
        const component = createTestComponent(undefined);

        const defaultProp = <ReactComponent />;
        // Simulate babel-plugin-add-react-displayname.
        defaultProp.type.displayName = 'ReactComponent';

        const { defaultValue } = extractPropDef(component, defaultProp);

        expect(defaultValue?.summary).toBe('<ReactComponent />');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support React element with props', () => {
        const component = createTestComponent(undefined);

        // @ts-expect-error (Converted from ts-ignore)
        const defaultProp = <ReactComponent className="toto" />;
        // Simulate babel-plugin-add-react-displayname.
        defaultProp.type.displayName = 'ReactComponent';

        const { defaultValue } = extractPropDef(component, defaultProp);

        expect(defaultValue?.summary).toBe('<ReactComponent />');
        expect(defaultValue?.detail).toBe('<ReactComponent className="toto" />');
      });

      it('should support short HTML element', () => {
        const component = createTestComponent(undefined);

        const { defaultValue } = extractPropDef(component, <div>HTML element</div>);

        expect(defaultValue?.summary).toBe('<div>HTML element</div>');
        expect(defaultValue?.detail).toBeUndefined();
      });

      it('should support long HTML element', () => {
        const component = createTestComponent(undefined);

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
          const component = createTestComponent(undefined, x);

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
          const component = createTestComponent(undefined, x);

          const { defaultValue } = extractPropDef(component, () => {
            return <div>Inlined FunctionalComponent!</div>;
          });

          expect(defaultValue?.summary).toBe('element');
          expect(defaultValue?.detail).toBeUndefined();
        });

        it(`should support inlined anonymous React functional component with props for ${x}`, () => {
          const component = createTestComponent(undefined, x);

          const { defaultValue } = extractPropDef(component, ({ foo }: { foo: string }) => {
            return <div>{foo}</div>;
          });

          expect(defaultValue?.summary).toBe('element');
          expect(defaultValue?.detail).toBeUndefined();
        });

        it(`should support inlined named React functional component for ${x}`, () => {
          const component = createTestComponent(undefined, x);

          const { defaultValue } = extractPropDef(component, function InlinedFunctionalComponent() {
            return <div>Inlined FunctionalComponent!</div>;
          });

          expect(defaultValue?.summary).toBe('<InlinedFunctionalComponent />');
          expect(defaultValue?.detail).toBeUndefined();
        });

        it(`should support inlined named React functional component with props for ${x}`, () => {
          const component = createTestComponent(undefined, x);

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
