// Ground-truth parity tests against the docgen-harness Angular fixtures (read-only): for every
// behavior the expected field spellings mirror each fixture's committed `compodoc-input.json`,
// except where the checker-based analyzer is deliberately better (noted inline).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import type { Directive, Method, Property } from '@storybook/angular-compodoc';
import type { AngularClassMeta, AngularFileMeta } from '../types.ts';
import { analyzeSourceFile } from './analyze-file.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARNESS_FIXTURES = join(HERE, '../../../docgen-harness/src/angular/__testfixtures__');

const CASES = [
  'complex-selector',
  'cross-file-inheritance',
  'decorator-generic',
  'decorator-getter-setter',
  'decorator-io-basics',
  'decorator-union-enum',
  'expression-defaults',
  'jsdoc-tags',
  'properties-methods-noise',
  'signal-io',
  'signal-model',
];

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: false,
  experimentalDecorators: true,
  allowJs: true,
  skipLibCheck: true,
  noEmit: true,
  allowImportingTsExtensions: true,
};

const componentFile = (caseName: string) =>
  join(HARNESS_FIXTURES, caseName, `${caseName}.component.ts`);

const program = ts.createProgram(CASES.map(componentFile), COMPILER_OPTIONS);
const checker = program.getTypeChecker();

const analyzed = new Map<string, AngularFileMeta>();
const analyzeCase = (caseName: string): AngularFileMeta => {
  let meta = analyzed.get(caseName);
  if (!meta) {
    const sourceFile = program.getSourceFile(componentFile(caseName));
    if (!sourceFile) {
      throw new Error(`fixture source file missing from program: ${caseName}`);
    }
    meta = analyzeSourceFile(ts, sourceFile, checker);
    analyzed.set(caseName, meta);
  }
  return meta;
};

const soleComponent = (meta: AngularFileMeta): AngularClassMeta & Directive => {
  expect(meta.components).toHaveLength(1);
  return meta.components[0] as AngularClassMeta & Directive;
};

const byName = <T extends { name: string }>(items: T[], name: string): T => {
  const item = items.find((candidate) => candidate.name === name);
  if (!item) {
    throw new Error(`no member named ${name} in [${items.map((entry) => entry.name).join(', ')}]`);
  }
  return item;
};

describe('analyzeSourceFile - docgen-harness fixture parity', () => {
  it('decorator-io-basics: optionality, function input, EventEmitter output', () => {
    const component = soleComponent(analyzeCase('decorator-io-basics'));
    expect(component.name).toBe('DecoratorIoBasicsComponent');
    expect(component.type).toBe('component');
    expect(component.file).toBe(componentFile('decorator-io-basics'));

    expect(component.inputsClass.map((input) => input.name)).toEqual([
      'count',
      'data',
      'formatter',
      'label',
    ]);
    expect(byName(component.inputsClass, 'count')).toMatchObject({
      type: 'number',
      optional: true,
    });
    expect(byName(component.inputsClass, 'count').required).toBeUndefined();
    expect(byName(component.inputsClass, 'count').defaultValue).toBeUndefined();
    expect(byName(component.inputsClass, 'data').type).toBe('any');
    // The signature, not compodoc's bare `function`: the summary is the only place a reader learns
    // the parameter and return types. `isFunctionTypeString` still gives it a function control.
    expect(byName(component.inputsClass, 'formatter').type).toBe('(value: number) => string');
    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      optional: false,
      defaultValue: "'Badge'",
      rawdescription: 'The text shown on the badge.',
    });

    expect(component.outputsClass).toHaveLength(1);
    expect(byName(component.outputsClass, 'clicked')).toMatchObject({
      type: 'EventEmitter',
      defaultValue: 'new EventEmitter<string>()',
    });
  });

  it('decorator-getter-setter: accessor input and private backing property', () => {
    const component = soleComponent(analyzeCase('decorator-getter-setter'));
    expect(byName(component.inputsClass, 'volume')).toMatchObject({
      type: 'number',
      optional: false,
      rawdescription: 'Playback volume, clamped between 0 and 10.',
    });
    expect(byName(component.propertiesClass, 'innerVolume')).toMatchObject({
      type: 'number',
      defaultValue: '5',
      optional: false,
    });
  });

  it('decorator-union-enum: double-quoted unions plus alias/enum misc collection', () => {
    const meta = analyzeCase('decorator-union-enum');
    const component = soleComponent(meta);
    expect(byName(component.inputsClass, 'size')).toMatchObject({
      type: '"small" | "large"',
      defaultValue: "'small'",
    });
    expect(byName(component.inputsClass, 'tone')).toMatchObject({
      type: 'ToneOption',
      defaultValue: "'info'",
    });
    expect(byName(component.inputsClass, 'kind')).toMatchObject({
      type: 'ButtonKind',
      defaultValue: 'ButtonKind.Primary',
    });

    expect(meta.miscellaneous.typealiases).toHaveLength(1);
    expect(meta.miscellaneous.typealiases[0]).toMatchObject({
      name: 'ToneOption',
      ctype: 'miscellaneous',
      subtype: 'typealias',
      rawtype: '"info" | "warn" | "error"',
    });
    expect(meta.miscellaneous.enumerations).toHaveLength(1);
    const [buttonKind] = meta.miscellaneous.enumerations;
    expect(buttonKind.name).toBe('ButtonKind');
    expect(buttonKind.childs).toEqual([
      { name: 'Primary', value: 'primary' },
      { name: 'Secondary', value: 'secondary' },
    ]);
    // The extractor's enum path only fires when every child value is truthy.
    for (const child of buttonKind.childs) {
      expect(typeof child.value).toBe('string');
      expect(child.value).toBeTruthy();
    }
  });

  it('decorator-generic: type parameters render syntactically', () => {
    const component = soleComponent(analyzeCase('decorator-generic'));
    expect(byName(component.inputsClass, 'items')).toMatchObject({
      type: 'T[]',
      defaultValue: '[]',
    });
    expect(byName(component.inputsClass, 'selected')).toMatchObject({
      type: 'T',
      optional: true,
    });
  });

  it('expression-defaults: raw initializer text with checker-inferred types', () => {
    const component = soleComponent(analyzeCase('expression-defaults'));
    // compodoc emitted `any` here (it types without a resolved program); a real checker infers
    // `number`.
    expect(byName(component.inputsClass, 'rows')).toMatchObject({
      type: 'number',
      defaultValue: 'Math.max(1, 3)',
    });
    expect(byName(component.inputsClass, 'timeoutMs')).toMatchObject({
      type: 'number',
      defaultValue: '5 * 60 * 1000',
    });
    expect(byName(component.outputsClass, 'saved')).toMatchObject({
      type: 'EventEmitter',
      defaultValue: 'new EventEmitter<void>()',
    });
  });

  it('jsdoc-tags: plain-text descriptions and tag comments', () => {
    const component = soleComponent(analyzeCase('jsdoc-tags'));
    expect(component.rawdescription).toBe('Renders a colored status chip.');
    expect(component.description).toBe('Renders a colored status chip.');
    expect(component.jsdoctags).toEqual([
      {
        tagName: { text: 'see', escapedText: 'see' },
        comment: 'https://example.com/design/chips',
      },
    ]);

    const text = byName(component.inputsClass, 'text');
    expect(text).toMatchObject({ type: 'string', defaultValue: "''" });
    expect(text.rawdescription).toBe('Chip text.');
    expect(text.jsdoctags).toEqual([
      {
        tagName: { text: 'deprecated', escapedText: 'deprecated' },
        comment: 'Use `label` on the parent panel instead.',
      },
      {
        tagName: { text: 'see', escapedText: 'see' },
        comment: 'https://example.com/docs/chip-text',
      },
      { tagName: { text: 'sbCategory', escapedText: 'sbCategory' }, comment: 'presentation' },
    ]);

    const accent = byName(component.inputsClass, 'accent');
    expect(accent).toMatchObject({ type: 'string', optional: true });
    expect(accent.defaultValue).toBeUndefined();
    // The `@default` comment stays plain text with its quotes; the extractor unwraps and uses it.
    expect(accent.jsdoctags).toEqual([
      { tagName: { text: 'default', escapedText: 'default' }, comment: "'steelblue'" },
    ]);
  });

  it('signal-io: required/optional flags, alias, generic and inferred value types', () => {
    const component = soleComponent(analyzeCase('signal-io'));
    expect(component.inputsClass.map((input) => input.name)).toEqual([
      'count',
      'disabled',
      'increment',
      'label',
    ]);
    expect(byName(component.inputsClass, 'count')).toMatchObject({
      type: 'number',
      optional: false,
      required: true,
    });
    expect(byName(component.inputsClass, 'count').defaultValue).toBeUndefined();
    expect(byName(component.inputsClass, 'disabled')).toMatchObject({
      type: 'boolean',
      optional: false,
      required: false,
      defaultValue: 'false',
    });
    expect(byName(component.inputsClass, 'increment')).toMatchObject({
      type: 'number',
      required: false,
      defaultValue: '1',
    });
    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      required: false,
      defaultValue: "''",
      rawdescription: 'Visible caption next to the control.',
    });

    expect(component.outputsClass).toHaveLength(1);
    expect(byName(component.outputsClass, 'toggled')).toMatchObject({
      type: 'boolean',
      optional: false,
      required: false,
    });

    expect(byName(component.propertiesClass, 'version')).toMatchObject({
      type: 'string',
      defaultValue: "'v1'",
    });
  });

  it('signal-model: model() appears in BOTH inputs and outputs under its bare name', () => {
    const component = soleComponent(analyzeCase('signal-model'));
    expect(component.inputsClass.map((input) => input.name)).toEqual(['checked', 'value']);
    expect(component.outputsClass.map((output) => output.name)).toEqual(['checked', 'value']);
    for (const list of [component.inputsClass, component.outputsClass]) {
      expect(byName(list, 'value')).toMatchObject({
        type: 'string',
        required: false,
        defaultValue: "'start'",
        rawdescription: 'Current text value of the field.',
      });
      expect(byName(list, 'checked')).toMatchObject({
        type: 'boolean',
        required: true,
        optional: false,
      });
    }
  });

  it('cross-file-inheritance: base-class members merge into the component', () => {
    const meta = analyzeCase('cross-file-inheritance');
    const component = soleComponent(meta);
    expect(component.inputsClass.map((input) => input.name)).toEqual(['dismissible', 'heading']);
    expect(byName(component.inputsClass, 'dismissible')).toMatchObject({
      type: 'boolean',
      defaultValue: 'false',
      rawdescription: 'Whether the alert shows a close button.',
    });
    expect(byName(component.outputsClass, 'dismissed')).toMatchObject({
      type: 'EventEmitter',
      defaultValue: 'new EventEmitter<void>()',
    });
    // The base class lives in another file, so this file's meta has no class records.
    expect(meta.classes).toEqual([]);

    // Analyzing the base file itself yields a plain-class record with its own IO split.
    const baseFile = program.getSourceFile(
      join(HARNESS_FIXTURES, 'cross-file-inheritance', 'base.component.ts')
    );
    const baseMeta = analyzeSourceFile(ts, baseFile!, checker);
    expect(baseMeta.classes).toHaveLength(1);
    const base = baseMeta.classes[0] as AngularClassMeta & {
      inputsClass?: Property[];
      outputsClass?: Property[];
    };
    expect(base).toMatchObject({ name: 'BaseAlertComponent', type: 'class' });
    expect(base.inputsClass?.map((input) => input.name)).toEqual(['dismissible']);
    expect(base.outputsClass?.map((output) => output.name)).toEqual(['dismissed']);
  });

  it('properties-methods-noise: query/host decorators surface on plain properties', () => {
    const component = soleComponent(analyzeCase('properties-methods-noise'));
    expect(component.inputsClass.map((input) => input.name)).toEqual(['title']);
    // `#secret` stays in the analyzer output for Compodoc parity; the modern extractor drops it.
    expect(component.propertiesClass.map((property) => property.name)).toEqual([
      '#secret',
      'currentPage',
      'isActive',
      'loading',
      'panel',
    ]);
    const currentPage = byName(component.propertiesClass, 'currentPage');
    expect(currentPage).toMatchObject({ type: 'number', defaultValue: '1' });
    expect(currentPage.decorators).toBeUndefined();
    // compodoc emitted `unknown` for the decorated host binding; the real checker knows better.
    expect(byName(component.propertiesClass, 'isActive')).toMatchObject({
      type: 'boolean',
      defaultValue: 'false',
      decorators: [{ name: 'HostBinding' }],
    });
    expect(byName(component.propertiesClass, 'panel')).toMatchObject({
      type: 'ElementRef<HTMLDivElement>',
      optional: true,
      decorators: [{ name: 'ViewChild' }],
    });
    expect(component.methodsClass).toHaveLength(1);
    expect(byName(component.methodsClass, 'nextPage')).toMatchObject({
      args: [],
      returnType: 'void',
    });
  });

  it('complex-selector: dispatch keys on the decorator, not the selector shape', () => {
    const component = soleComponent(analyzeCase('complex-selector'));
    expect(component.name).toBe('ComplexSelectorComponent');
    expect(byName(component.inputsClass, 'emphasis')).toMatchObject({
      type: 'boolean',
      defaultValue: 'false',
    });
  });

  it('selector: the decorator string literal verbatim, including multi-part selectors', () => {
    expect(soleComponent(analyzeCase('decorator-io-basics')).selector).toBe(
      'sb-decorator-io-basics'
    );
    expect(soleComponent(analyzeCase('complex-selector')).selector).toBe(
      'button[sb-harness-action], a[sb-harness-action]'
    );
    // Undecorated classes have no selector.
    const baseFile = program.getSourceFile(
      join(HARNESS_FIXTURES, 'cross-file-inheritance', 'base.component.ts')
    );
    const baseMeta = analyzeSourceFile(ts, baseFile!, checker);
    expect(baseMeta.classes[0].selector).toBeUndefined();
  });

  // Sortedness is the one runtime contract here (analyze-file must call sortMembers after the
  // inheritance merge); the member shapes themselves are enforced by the compodoc types.
  it('invariants: members sorted by name within each array', () => {
    for (const caseName of CASES) {
      const meta = analyzeCase(caseName);
      const records = [
        ...meta.components,
        ...meta.directives,
        ...meta.pipes,
        ...meta.injectables,
        ...meta.classes,
      ] as (AngularClassMeta &
        Partial<Directive> & { properties?: Property[]; methods?: Method[] })[];
      for (const record of records) {
        const lists = [
          record.inputsClass,
          record.outputsClass,
          record.propertiesClass,
          record.properties,
          record.methodsClass,
          record.methods,
        ];
        for (const list of lists) {
          const names = (list ?? []).map((item) => item.name);
          expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
        }
      }
    }
  });
});
