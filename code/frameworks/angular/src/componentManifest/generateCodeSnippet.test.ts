import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import type { Directive } from '../client/compodoc-types';
import {
  extractArgsNode,
  generateAngularSnippet,
  mergeArgsFromAst,
} from './generateCodeSnippet';

// Helper: create a Compodoc component/directive fixture
const makeComponent = (overrides: Record<string, any> = {}): Directive =>
  ({
    name: 'ButtonComponent',
    type: 'component',
    selector: 'app-button',
    inputsClass: [
      { name: 'label', type: 'string', optional: false },
      { name: 'primary', type: 'boolean', optional: true, defaultValue: 'false' },
      { name: 'size', type: 'string', optional: true },
    ],
    outputsClass: [{ name: 'onClick', type: 'EventEmitter<void>', optional: false }],
    propertiesClass: [],
    methodsClass: [],
    ...overrides,
  }) as any;

// Helper: build a simple AST ObjectExpression from key-value pairs
function buildObjectExpression(
  props: Record<string, t.Expression>
): t.ObjectExpression {
  return t.objectExpression(
    Object.entries(props).map(([key, value]) =>
      t.objectProperty(t.identifier(key), value)
    )
  );
}

describe('extractArgsNode', () => {
  it('should extract the args ObjectExpression from a meta node', () => {
    const argsObj = t.objectExpression([
      t.objectProperty(t.identifier('label'), t.stringLiteral('Click me')),
    ]);
    const metaNode = buildObjectExpression({
      title: t.stringLiteral('Example/Button'),
      args: argsObj,
    });

    const result = extractArgsNode(metaNode);
    expect(result).toBe(argsObj);
  });

  it('should return undefined when no args property exists', () => {
    const metaNode = buildObjectExpression({
      title: t.stringLiteral('Example/Button'),
    });

    const result = extractArgsNode(metaNode);
    expect(result).toBeUndefined();
  });

  it('should return undefined when args is not an ObjectExpression', () => {
    const metaNode = buildObjectExpression({
      args: t.identifier('someVariable'),
    });

    const result = extractArgsNode(metaNode);
    expect(result).toBeUndefined();
  });

  it('should return undefined for undefined input', () => {
    expect(extractArgsNode(undefined)).toBeUndefined();
  });
});

describe('mergeArgsFromAst', () => {
  it('should merge meta args with story args', () => {
    const metaNode = buildObjectExpression({
      args: buildObjectExpression({
        label: t.stringLiteral('Default'),
      }),
    });
    const storyAnnotations = {
      args: buildObjectExpression({
        label: t.stringLiteral('Primary'),
        primary: t.booleanLiteral(true),
      }),
    };

    const result = mergeArgsFromAst(metaNode, storyAnnotations);
    // Story args should override meta args
    expect(result).toEqual({ label: 'Primary', primary: true });
  });

  it('should handle meta args only', () => {
    const metaNode = buildObjectExpression({
      args: buildObjectExpression({
        label: t.stringLiteral('Default'),
      }),
    });

    const result = mergeArgsFromAst(metaNode, undefined);
    expect(result).toEqual({ label: 'Default' });
  });

  it('should handle story args only', () => {
    const storyAnnotations = {
      args: buildObjectExpression({
        primary: t.booleanLiteral(true),
      }),
    };

    const result = mergeArgsFromAst(undefined, storyAnnotations);
    expect(result).toEqual({ primary: true });
  });

  it('should return empty object when no args are defined', () => {
    const result = mergeArgsFromAst(undefined, undefined);
    expect(result).toEqual({});
  });

  it('should handle all literal types', () => {
    const storyAnnotations = {
      args: buildObjectExpression({
        str: t.stringLiteral('hello'),
        num: t.numericLiteral(42),
        bool: t.booleanLiteral(true),
        nil: t.nullLiteral(),
        negNum: t.unaryExpression('-', t.numericLiteral(5)),
        arr: t.arrayExpression([t.stringLiteral('a'), t.numericLiteral(1)]),
        obj: buildObjectExpression({ nested: t.stringLiteral('value') }),
      }),
    };

    const result = mergeArgsFromAst(undefined, storyAnnotations);
    expect(result).toEqual({
      str: 'hello',
      num: 42,
      bool: true,
      nil: null,
      negNum: -5,
      arr: ['a', 1],
      obj: { nested: 'value' },
    });
  });

  it('should return undefined for non-literal values (identifiers, functions)', () => {
    const storyAnnotations = {
      args: buildObjectExpression({
        handler: t.identifier('myHandler'),
        fn: t.arrowFunctionExpression([], t.blockStatement([])),
      }),
    };

    const result = mergeArgsFromAst(undefined, storyAnnotations);
    expect(result).toEqual({ handler: undefined, fn: undefined });
  });
});

describe('generateAngularSnippet', () => {
  it('should generate a basic template with no args', () => {
    const component = makeComponent();
    const result = generateAngularSnippet(undefined, component);
    expect(result).toBe('<app-button></app-button>');
  });

  it('should generate a template with empty args', () => {
    const component = makeComponent();
    const result = generateAngularSnippet({}, component);
    expect(result).toBe('<app-button></app-button>');
  });

  it('should generate property bindings for string inputs', () => {
    const component = makeComponent();
    const result = generateAngularSnippet({ label: 'Click me' }, component);
    expect(result).toContain(`[label]="'Click me'"`);
    expect(result).toMatch(/^<app-button .+><\/app-button>$/);
  });

  it('should generate property bindings for boolean inputs', () => {
    const component = makeComponent();
    const result = generateAngularSnippet({ primary: true }, component);
    expect(result).toContain('[primary]="true"');
  });

  it('should generate property bindings for number inputs', () => {
    const component = makeComponent({
      inputsClass: [{ name: 'count', type: 'number', optional: true }],
    });
    const result = generateAngularSnippet({ count: 42 }, component);
    expect(result).toContain('[count]="42"');
  });

  it('should generate event bindings for outputs', () => {
    const component = makeComponent();
    const result = generateAngularSnippet({ onClick: 'handler' }, component);
    expect(result).toContain('(onClick)="onClick($event)"');
  });

  it('should generate a complete template with mixed inputs and outputs', () => {
    const component = makeComponent();
    const result = generateAngularSnippet(
      { label: 'Click me', primary: true, onClick: () => {} },
      component
    );
    expect(result).toContain(`[label]="'Click me'"`);
    expect(result).toContain('[primary]="true"');
    expect(result).toContain('(onClick)="onClick($event)"');
    expect(result).toMatch(/^<app-button .+><\/app-button>$/);
  });

  it('should skip undefined values', () => {
    const component = makeComponent();
    const result = generateAngularSnippet(
      { label: 'Hello', primary: undefined },
      component
    );
    expect(result).toContain(`[label]="'Hello'"`);
    expect(result).not.toContain('primary');
  });

  it('should handle object values as serialized bindings', () => {
    const component = makeComponent({
      inputsClass: [{ name: 'config', type: 'object', optional: true }],
    });
    const result = generateAngularSnippet(
      { config: { key: 'value' } },
      component
    );
    expect(result).toContain('[config]=');
    expect(result).toContain('key');
  });

  it('should use the first selector when multiple selectors are defined', () => {
    const component = makeComponent({ selector: 'app-button, button[appButton]' });
    const result = generateAngularSnippet(undefined, component);
    expect(result).toBe('<app-button></app-button>');
  });

  it('should return undefined when no selector is available', () => {
    const component = makeComponent({ selector: undefined });
    const result = generateAngularSnippet({ label: 'Hello' }, component);
    expect(result).toBeUndefined();
  });

  it('should return undefined when componentData is undefined', () => {
    const result = generateAngularSnippet({ label: 'Hello' }, undefined);
    expect(result).toBeUndefined();
  });

  it('should handle string values with single quotes', () => {
    const component = makeComponent();
    const result = generateAngularSnippet({ label: "it's a test" }, component);
    expect(result).toContain('[label]=');
    expect(result).toContain('test');
  });
});
