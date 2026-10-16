import { describe, expect, it } from 'vitest';

import { byName, componentIn } from './__testutils__/inline-source.ts';

const initializerIn = (classBody: string, topLevel = '') => {
  const component = componentIn(`
    import { Component } from '@angular/core';

    ${topLevel}

    @Component({ selector: 'sb-defaults', template: '' })
    export class DefaultsComponent {
      ${classBody}
    }
  `);
  return (name: string) => byName(component.propertiesClass, name).initializer;
};

describe('default initializer classification', () => {
  it('keeps scalar literals, numeric spellings, and interpolation-free templates', () => {
    const initializer = initializerIn(`
      text = 'ready';
      template = \`ready\`;
      decimal = -1.5e-3;
      hex = 0xFF;
      binary = +0b101;
      separated = 1_000;
      bigint = 42n;
      negativeBigint = -42n;
      absent = undefined;
    `);

    expect(initializer('text')).toEqual({
      kind: 'literal',
      literalKind: 'string',
      text: "'ready'",
    });
    expect(initializer('template')).toEqual({
      kind: 'literal',
      literalKind: 'string',
      text: '`ready`',
    });
    expect(initializer('decimal')).toEqual({
      kind: 'literal',
      literalKind: 'number',
      text: '-1.5e-3',
    });
    expect(initializer('hex')).toEqual({
      kind: 'literal',
      literalKind: 'number',
      text: '0xFF',
    });
    expect(initializer('binary')).toEqual({
      kind: 'literal',
      literalKind: 'number',
      text: '+0b101',
    });
    expect(initializer('separated')).toEqual({
      kind: 'literal',
      literalKind: 'number',
      text: '1_000',
    });
    expect(initializer('bigint')).toEqual({
      kind: 'literal',
      literalKind: 'bigint',
      text: '42n',
    });
    expect(initializer('negativeBigint')).toEqual({
      kind: 'literal',
      literalKind: 'bigint',
      text: '-42n',
    });
    expect(initializer('absent')).toEqual({
      kind: 'literal',
      literalKind: 'undefined',
      text: 'undefined',
    });
  });

  it.each([
    ['inferred type', `const runtime = () => 7; const undefined = runtime();`],
    [
      'undefined annotation',
      `const runtime = (): unknown => 7; const undefined: undefined = runtime() as undefined;`,
    ],
  ])('does not trust a local undefined binding with %s', (_name, topLevel) => {
    const initializer = initializerIn(`value = undefined;`, topLevel);

    expect(initializer('value')).toEqual({ kind: 'expression', text: 'undefined' });
  });

  it('uses the checker to distinguish enum members from arbitrary dotted values', () => {
    const initializer = initializerIn(
      `
        tone = Tone.Primary;
        runtime = settings.primary;
      `,
      `
        enum Tone { Primary = 'primary' }
        const settings = { primary: 'primary' };
      `
    );

    expect(initializer('tone')).toEqual({
      kind: 'literal',
      literalKind: 'enum',
      text: 'Tone.Primary',
    });
    expect(initializer('runtime')).toEqual({ kind: 'expression', text: 'settings.primary' });
  });

  it('accepts nested literal composites and strips top-level type wrappers', () => {
    const initializer = initializerIn(
      `
        nested = { tones: [Tone.Primary, { label: \`ready\`, enabled: true }] };
        asserted = ('ready' as const)!;
        satisfied = ('ready' satisfies string);
        cast = <string>'ready';
      `,
      `enum Tone { Primary = 'primary' }`
    );

    expect(initializer('nested')).toEqual({
      kind: 'literal',
      literalKind: 'composite',
      text: '{ tones: [Tone.Primary, { label: `ready`, enabled: true }] }',
    });
    expect(initializer('asserted')).toEqual({
      kind: 'literal',
      literalKind: 'string',
      text: "'ready'",
    });
    expect(initializer('satisfied')).toEqual({
      kind: 'literal',
      literalKind: 'string',
      text: "'ready'",
    });
    expect(initializer('cast')).toEqual({
      kind: 'literal',
      literalKind: 'string',
      text: "'ready'",
    });
  });

  it('rejects executable and structurally ambiguous composite values', () => {
    const initializer = initializerIn(
      `
        spreadObject = { ...defaults };
        shorthand = { option };
        computedKey = { [key]: 1 };
        namedElement = [DEFAULT];
        spreadArray = [...values];
        call = makeDefault();
        constructed = new Map();
        binary = 5 * 60 * 1000;
        interpolated = \`item-\${DEFAULT}\`;
        method = { run() {} };
        accessor = { get value() { return 1; } };
      `,
      `
        const defaults = { value: 1 };
        const option = 1;
        const key = 'value';
        const DEFAULT = 1;
        const values = [1];
        const makeDefault = () => 1;
      `
    );

    for (const name of [
      'spreadObject',
      'shorthand',
      'computedKey',
      'namedElement',
      'spreadArray',
      'call',
      'constructed',
      'binary',
      'interpolated',
      'method',
      'accessor',
    ]) {
      expect(initializer(name)).toMatchObject({ kind: 'expression' });
    }
  });
});
