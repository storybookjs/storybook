import { describe, expect, it } from 'vitest';

import { parse } from './acornParser';
import type {
  InspectionArray,
  InspectionElement,
  InspectionFunction,
  InspectionIdentifier,
  InspectionLiteral,
  InspectionObject,
  InspectionUnknown,
} from './types';
import { InspectionType } from './types';

describe('parse', () => {
  describe('expression', () => {
    it('support HTML element', () => {
      const result = parse('<div>Hello!</div>');
      const inferredType = result.inferredType as InspectionElement;

      expect(inferredType.type).toBe(InspectionType.ELEMENT);
      expect(inferredType.identifier).toBe('div');
      expect(result.ast).toBeDefined();
    });

    it('support React declaration', () => {
      const result = parse('<FunctionalComponent />');
      const inferredType = result.inferredType as InspectionElement;

      expect(inferredType.type).toBe(InspectionType.ELEMENT);
      expect(inferredType.identifier).toBe('FunctionalComponent');
      expect(result.ast).toBeDefined();
    });

    it('support anonymous functional React component', () => {
      const result = parse('() => { return <div>Hey!</div>; }');
      const inferredType = result.inferredType as InspectionElement;

      expect(inferredType.type).toBe(InspectionType.ELEMENT);
      expect(inferredType.identifier).toBeUndefined();
      expect(result.ast).toBeDefined();
    });

    it('support named functional React component', () => {
      const result = parse('function NamedFunctionalComponent() { return <div>Hey!</div>; }');
      const inferredType = result.inferredType as InspectionElement;

      expect(inferredType.type).toBe(InspectionType.ELEMENT);
      expect(inferredType.identifier).toBe('NamedFunctionalComponent');
      expect(result.ast).toBeDefined();
    });

    it('support class React component', () => {
      const result = parse(`
        class ClassComponent extends React.PureComponent {
          render() {
            return <div>Hey!</div>;
          }
      }`);
      const inferredType = result.inferredType as InspectionElement;

      expect(inferredType.type).toBe(InspectionType.ELEMENT);
      expect(inferredType.identifier).toBe('ClassComponent');
      expect(result.ast).toBeDefined();
    });

    it('support PropTypes.shape', () => {
      const result = parse('PropTypes.shape({ foo: PropTypes.string })');
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(1);
      expect(result.ast).toBeDefined();
    });

    it('support deep PropTypes.shape', () => {
      const result = parse('PropTypes.shape({ foo: PropTypes.shape({ bar: PropTypes.string }) })');
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(2);
      expect(result.ast).toBeDefined();
    });

    it('support shape', () => {
      const result = parse('shape({ foo: string })');
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(1);
      expect(result.ast).toBeDefined();
    });

    it('support deep shape', () => {
      const result = parse('shape({ foo: shape({ bar: string }) })');
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(2);
      expect(result.ast).toBeDefined();
    });

    it('support single prop object literal', () => {
      const result = parse('{ foo: PropTypes.string }');
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(1);
      expect(result.ast).toBeDefined();
    });

    it('support multi prop object literal', () => {
      const result = parse(`
      {
          foo: PropTypes.string,
          bar: PropTypes.string
      }`);
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(1);
      expect(result.ast).toBeDefined();
    });

    it('support deep object literal', () => {
      const result = parse(`
      {
          foo: {
            hey: PropTypes.string
          },
          bar: PropTypes.string,
          hey: {
            ho: PropTypes.string
          }
      }`);
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(2);
      expect(result.ast).toBeDefined();
    });

    it('support required prop', () => {
      const result = parse('{ foo: PropTypes.string.isRequired }');
      const inferredType = result.inferredType as InspectionObject;

      expect(inferredType.type).toBe(InspectionType.OBJECT);
      expect(inferredType.depth).toBe(1);
      expect(result.ast).toBeDefined();
    });

    it('support array', () => {
      const result = parse("['bottom-left', 'bottom-center', 'bottom-right']");
      const inferredType = result.inferredType as InspectionArray;

      expect(inferredType.type).toBe(InspectionType.ARRAY);
      expect(inferredType.depth).toBe(1);
      expect(result.ast).toBeDefined();
    });

    it('support deep array', () => {
      const result = parse("['bottom-left', { foo: string }, [['hey', 'ho']]]");
      const inferredType = result.inferredType as InspectionArray;

      expect(inferredType.type).toBe(InspectionType.ARRAY);
      expect(inferredType.depth).toBe(3);
      expect(result.ast).toBeDefined();
    });

    it('support object identifier', () => {
      const result = parse('NAMED_OBJECT');
      const inferredType = result.inferredType as InspectionIdentifier;

      expect(inferredType.type).toBe(InspectionType.IDENTIFIER);
      expect(inferredType.identifier).toBe('NAMED_OBJECT');
      expect(result.ast).toBeDefined();
    });

    it('support anonymous function', () => {
      const result = parse('() => {}');
      const inferredType = result.inferredType as InspectionFunction;

      expect(inferredType.type).toBe(InspectionType.FUNCTION);
      expect(inferredType.identifier).toBeUndefined();
      expect(inferredType.hasParams).toBeFalsy();
      expect(inferredType.params.length).toBe(0);
      expect(result.ast).toBeDefined();
    });

    it('support anonymous function with arguments', () => {
      const result = parse('(a, b) => {}');
      const inferredType = result.inferredType as InspectionFunction;

      expect(inferredType.type).toBe(InspectionType.FUNCTION);
      expect(inferredType.identifier).toBeUndefined();
      expect(inferredType.hasParams).toBeTruthy();
      expect(inferredType.params.length).toBe(2);
      expect(result.ast).toBeDefined();
    });

    it('support named function', () => {
      const result = parse('function concat() {}');
      const inferredType = result.inferredType as InspectionFunction;

      expect(inferredType.type).toBe(InspectionType.FUNCTION);
      expect(inferredType.identifier).toBe('concat');
      expect(inferredType.hasParams).toBeFalsy();
      expect(inferredType.params.length).toBe(0);
      expect(result.ast).toBeDefined();
    });

    it('support named function with arguments', () => {
      const result = parse('function concat(a, b) {}');
      const inferredType = result.inferredType as InspectionFunction;

      expect(inferredType.type).toBe(InspectionType.FUNCTION);
      expect(inferredType.identifier).toBe('concat');
      expect(inferredType.hasParams).toBeTruthy();
      expect(inferredType.params.length).toBe(2);
      expect(result.ast).toBeDefined();
    });

    it('support class', () => {
      const result = parse('class Foo {}');
      const inferredType = result.inferredType as InspectionFunction;

      expect(inferredType.type).toBe(InspectionType.CLASS);
      expect(inferredType.identifier).toBe('Foo');
      expect(result.ast).toBeDefined();
    });

    [
      { name: 'string', value: "'string value'" },
      { name: 'numeric', value: '1' },
      { name: 'boolean (true)', value: 'true' },
      { name: 'boolean (false)', value: 'false' },
      { name: 'null', value: 'null' },
    ].forEach((x) => {
      it(`support ${x.name}`, () => {
        const result = parse(x.value);
        const inferredType = result.inferredType as InspectionLiteral;

        expect(inferredType.type).toBe(InspectionType.LITERAL);
        expect(result.ast).toBeDefined();
      });
    });

    it("returns Unknown when it's not supported", () => {
      const result = parse("Symbol('foo')");
      const inferredType = result.inferredType as InspectionUnknown;

      expect(inferredType.type).toBe(InspectionType.UNKNOWN);
      expect(result.ast).toBeDefined();
    });
  });
});
