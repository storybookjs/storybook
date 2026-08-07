// Behavior coverage the docgen-harness fixtures do not exercise: decorator alias/required
// matrices, pipes/injectables/plain classes, the bare-name signal fallback, misc collection edge
// cases (numeric enums, alias cycles) and multi-level inheritance including a d.ts base.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import type { CompodocJson, Directive, Method, Property } from '@storybook/angular-compodoc';
import { extractArgTypesFromData, unwrapPlainText } from '@storybook/angular-compodoc';
import type { AngularClassMeta, AngularFileMeta } from '../types.ts';
import { analyzeSourceFile } from './analyze-file.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const FIXTURE_FILES = [
  'alias-required.component.ts',
  'kitchen.ts',
  'signal-fallback.component.ts',
  'signal-checker.component.ts',
  'not-a-signal.component.ts',
  'misc.component.ts',
  'inherit-chain.component.ts',
  'checker-misc.component.ts',
  'override-input.component.ts',
  'selector-indirect.component.ts',
  'clarity-edges.component.ts',
  'metadata-io.component.ts',
].map((file) => join(FIXTURES, file));

const program = ts.createProgram(FIXTURE_FILES, {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: false,
  experimentalDecorators: true,
  allowJs: true,
  skipLibCheck: true,
  noEmit: true,
  allowImportingTsExtensions: true,
});
const checker = program.getTypeChecker();

const analyze = (file: string): AngularFileMeta => {
  const sourceFile = program.getSourceFile(join(FIXTURES, file));
  if (!sourceFile) {
    throw new Error(`fixture source file missing from program: ${file}`);
  }
  return analyzeSourceFile(ts, sourceFile, checker);
};

const byName = <T extends { name: string }>(items: T[] | undefined, name: string): T => {
  const item = items?.find((candidate) => candidate.name === name);
  if (!item) {
    throw new Error(
      `no member named ${name} in [${(items ?? []).map((entry) => entry.name).join(', ')}]`
    );
  }
  return item;
};

/** What the docgen worker passes for analyzer-produced records: plain-text comments, modern rules. */
const ANALYZER_EXTRACT_OPTIONS = {
  filterNonInputControls: undefined,
  unwrapHtml: unwrapPlainText,
  modern: true,
} as const;

describe('decorator inputs and outputs', () => {
  const component = () => analyze('alias-required.component.ts').components[0] as Directive;

  it('applies aliases and reads the actual `required` boolean', () => {
    const inputs = component().inputsClass;
    expect(inputs.map((input) => input.name)).toEqual([
      'anotherDefaultValue',
      'buttonLabel',
      'hint',
      'tone',
    ]);

    // An accessor input has no initializer, so its `@default` tag is the only default carrier.
    expect(byName(inputs, 'anotherDefaultValue')).toMatchObject({
      type: 'string',
      jsdoctags: [
        {
          tagName: { text: 'default', escapedText: 'default' },
          comment: 'Another default value',
        },
      ],
    });

    const buttonLabel = byName(inputs, 'buttonLabel');
    expect(buttonLabel).toMatchObject({ optional: false, defaultValue: "''", type: 'string' });
    expect(buttonLabel.required).toBeUndefined();

    // `@Input({ required: true })` also overrides TS optionality.
    expect(byName(inputs, 'tone')).toMatchObject({
      required: true,
      optional: false,
      type: 'string',
    });

    // Unlike compodoc, the analyzer reads the flag's value, not its presence.
    expect(byName(inputs, 'hint')).toMatchObject({
      required: false,
      optional: true,
      type: 'string',
    });
  });

  it('applies output aliases', () => {
    const outputs = component().outputsClass;
    expect(outputs.map((output) => output.name)).toEqual(['saved']);
    expect(byName(outputs, 'saved')).toMatchObject({
      type: 'EventEmitter',
      defaultValue: 'new EventEmitter<number>()',
    });
  });
});

describe('pipes, injectables and plain classes', () => {
  const meta = () => analyze('kitchen.ts');

  it('extracts pipes with their template name', () => {
    const pipe = meta().pipes[0] as AngularClassMeta & { ngname: string; methods: Method[] };
    expect(pipe).toMatchObject({
      name: 'FormatPipe',
      type: 'pipe',
      ngname: 'sbFormat',
      rawdescription: 'Formats things.',
    });
    const transform = byName(pipe.methods, 'transform');
    expect(transform.args).toEqual([
      { name: 'value', type: 'string', optional: false },
      { name: 'width', type: 'number', optional: true },
    ]);
    expect(transform.returnType).toBe('string');
  });

  it('extracts injectables', () => {
    const [injectable] = meta().injectables;
    expect(injectable).toMatchObject({ name: 'DataService', type: 'injectable' });
    const record = injectable as AngularClassMeta & {
      properties: Property[];
      methods: { name: string; returnType: string }[];
    };
    expect(byName(record.properties, 'rows')).toMatchObject({ type: 'number', defaultValue: '3' });
    expect(byName(record.methods, 'load').returnType).toBe('Promise<string[]>');
  });

  it('extracts plain classes, with parameter properties but no constructor method', () => {
    const [paginator] = meta().classes;
    expect(paginator).toMatchObject({ name: 'Paginator', type: 'class' });
    const record = paginator as AngularClassMeta & {
      properties: Property[];
      methods: { name: string }[];
    };
    expect(record.properties.map((property) => property.name)).toEqual(['page', 'pageSize']);
    expect(byName(record.properties, 'pageSize')).toMatchObject({ type: 'number' });
    expect(record.methods.map((method) => method.name)).toEqual(['next']);
  });

  it('skips NgModule classes entirely', () => {
    const kitchen = meta();
    const allNames = [
      ...kitchen.components,
      ...kitchen.directives,
      ...kitchen.pipes,
      ...kitchen.injectables,
      ...kitchen.classes,
    ].map((record) => record.name);
    expect(allNames).not.toContain('NoiseModule');
  });
});

describe('signal detection', () => {
  it('falls back to bare-name matching when the signal symbols do not resolve', () => {
    const component = analyze('signal-fallback.component.ts').components[0] as Directive;
    expect(component.inputsClass.map((input) => input.name)).toEqual([
      'count',
      'increment',
      'label',
      'value',
    ]);
    // Types come from explicit generics or literal defaults; the checker has nothing here.
    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      required: false,
      optional: false,
      defaultValue: "'hi'",
    });
    expect(byName(component.inputsClass, 'count')).toMatchObject({
      type: 'number',
      required: true,
    });
    expect(byName(component.inputsClass, 'increment')).toMatchObject({
      type: 'number',
      defaultValue: '2',
    });

    expect(component.outputsClass.map((output) => output.name)).toEqual(['toggled', 'value']);
    expect(byName(component.outputsClass, 'toggled')).toMatchObject({
      type: 'boolean',
      required: false,
    });
    // model() again lands in both arrays.
    for (const list of [component.inputsClass, component.outputsClass]) {
      expect(byName(list, 'value')).toMatchObject({ type: 'number', defaultValue: '1' });
    }

    // An unknown call stays a plain property.
    expect(byName(component.propertiesClass, 'notSignal')).toMatchObject({
      defaultValue: "compute('x')",
    });
  });

  it('unwraps InputSignal/ModelSignal/OutputEmitterRef via the checker when literals cannot type it', () => {
    const component = analyze('signal-checker.component.ts').components[0] as Directive;
    expect(byName(component.inputsClass, 'ratios')).toMatchObject({
      type: 'number[]',
      defaultValue: '[0.5, 1]',
    });
    expect(byName(component.inputsClass, 'align')).toMatchObject({
      type: '"left" | "right"',
      defaultValue: "'left' as 'left' | 'right'",
    });
    expect(byName(component.outputsClass, 'tags')).toMatchObject({ type: 'Set<string>' });
  });

  it('falls back when the @angular/core import exists but cannot be resolved', () => {
    // Classic resolution never looks in node_modules, so the import stays an unresolved alias.
    const file = join(FIXTURES, 'unresolved-core.component.ts');
    const isolated = ts.createProgram([file], {
      target: ts.ScriptTarget.Latest,
      moduleResolution: ts.ModuleResolutionKind.Classic,
      experimentalDecorators: true,
      noEmit: true,
    });
    const meta = analyzeSourceFile(ts, isolated.getSourceFile(file)!, isolated.getTypeChecker());
    const component = meta.components[0] as Directive;
    expect(byName(component.inputsClass, 'label')).toMatchObject({
      type: 'string',
      defaultValue: "'hi'",
      required: false,
    });
    expect(byName(component.inputsClass, 'checked')).toMatchObject({
      type: 'boolean',
      required: true,
    });
    expect(byName(component.outputsClass, 'toggled')).toMatchObject({ type: 'boolean' });
  });

  it('does not treat a resolved non-Angular `input` function as a signal', () => {
    const component = analyze('not-a-signal.component.ts').components[0] as Directive;
    expect(component.inputsClass).toEqual([]);
    expect(byName(component.propertiesClass, 'label')).toMatchObject({
      type: 'string',
      defaultValue: "input('hi')",
    });
  });
});

describe('misc collection and member noise rules', () => {
  const meta = () => analyze('misc.component.ts');

  it('collects referenced aliases recursively, surviving cycles', () => {
    const typealiases = meta().miscellaneous.typealiases;
    expect(typealiases.map((alias) => alias.name)).toEqual(['Inner', 'LoopA', 'LoopB', 'Outer']);
    expect(byName(typealiases, 'Outer').rawtype).toBe('Inner');
    expect(byName(typealiases, 'Inner').rawtype).toBe('"x" | "y"');
    expect(byName(typealiases, 'LoopA').rawtype).toBe('LoopB');
    expect(byName(typealiases, 'LoopB').rawtype).toBe('LoopA');
  });

  it('collects enums with compodoc value semantics', () => {
    const enumerations = meta().miscellaneous.enumerations;
    expect(enumerations.map((enumeration) => enumeration.name)).toEqual(['Numeric', 'Weird']);
    // No initializer and non-literal initializers carry no value; numeric literals stay numbers.
    expect(byName(enumerations, 'Numeric').childs).toEqual([
      { name: 'Zero' },
      { name: 'One', value: 1 },
    ]);
    expect(byName(enumerations, 'Weird').childs).toEqual([{ name: 'Computed' }]);
  });

  it('keeps private/protected/static members and lifecycle hooks, drops @ignore', () => {
    const component = meta().components[0] as Directive;
    expect(component.propertiesClass.map((property) => property.name)).toEqual([
      'cache',
      'counter',
      'formatter',
      'shield',
      'zoom',
    ]);
    expect(component.methodsClass.map((method) => method.name)).toEqual(['ngOnInit']);
  });

  it('collapses arrow defaults and reads accessor pairs as properties', () => {
    const component = meta().components[0] as Directive;
    expect(byName(component.propertiesClass, 'formatter')).toMatchObject({
      defaultValue: '() => {...}',
      type: '(value: number) => string',
    });
    expect(byName(component.propertiesClass, 'zoom')).toMatchObject({
      type: 'number',
      optional: false,
    });
  });

  it('emits class and member jsdoctags with plain-text comments', () => {
    const component = meta().components[0] as AngularClassMeta & Directive;
    expect(component.rawdescription).toBe('Shows misc collection.');
    expect(component.jsdoctags).toEqual([
      { tagName: { text: 'summary', escapedText: 'summary' }, comment: 'A summary line.' },
    ]);
    const onChange = byName(component.inputsClass, 'onChange');
    expect(onChange.rawdescription).toBe('Callback invoked on change.');
    expect(onChange.jsdoctags).toEqual([
      { tagName: { text: 'default', escapedText: 'default' }, comment: "'none'" },
    ]);
  });
});

describe('checker-inferred types and member edge cases', () => {
  const meta = () => analyze('checker-misc.component.ts');
  const component = () => meta().components[0] as Directive;
  const argTypes = () =>
    extractArgTypesFromData(component(), {
      compodocJson: meta() as unknown as CompodocJson,
      filterNonInputControls: false,
      unwrapHtml: (html) => String(html),
    });

  it('feeds checker-inferred enum and signal alias types into miscellaneous', () => {
    const { miscellaneous } = meta();
    expect(byName(miscellaneous.enumerations, 'Status').childs).toEqual([
      { name: 'Active', value: 'active' },
      { name: 'Inactive', value: 'inactive' },
    ]);
    expect(byName(miscellaneous.typealiases, 'Side').rawtype).toBe('"left" | "right"');
    expect(byName(component().inputsClass, 'status').type).toBe('Status');
    expect(byName(component().inputsClass, 'align').type).toBe('Side');
  });

  it('yields enum argTypes for checker-inferred types through extractArgTypesFromData', () => {
    expect(argTypes().status.type).toEqual({ name: 'enum', value: ['active', 'inactive'] });
    expect(argTypes().align.type).toEqual({ name: 'enum', value: ['left', 'right'] });
  });

  it('renders string-literal types JSON-escaped so the enum fallback can parse them', () => {
    expect(byName(component().inputsClass, 'dir').type).toBe('"a\\"b" | "c"');
    expect(argTypes().dir.type).toEqual({ name: 'enum', value: ['a"b', 'c'] });
  });

  it('keeps static input()-initialized properties out of signal IO', () => {
    expect(component().inputsClass.map((input) => input.name)).not.toContain('defaults');
    expect(byName(component().propertiesClass, 'defaults')).toMatchObject({
      defaultValue: "input('nope')",
    });
  });

  it('emits one methodsClass entry per overloaded method, preferring the implementation', () => {
    const formats = component().methodsClass.filter((method) => method.name === 'format');
    expect(formats).toHaveLength(1);
    expect(formats[0]).toMatchObject({
      args: [{ name: 'value', type: 'string | number', optional: false }],
      returnType: 'string | number',
    });
  });

  it('keeps @HostListener methods in methodsClass, matching legacy compodoc', () => {
    // Legacy compodoc pushed every MethodDeclaration into methodsClass; @HostListener ones
    // additionally landed in the separate hostListeners bucket Storybook ignores.
    expect(component().methodsClass.map((method) => method.name)).toContain('onResize');
  });
});

describe('selector extraction', () => {
  it('follows an identifier selector to its string-literal initializer', () => {
    const meta = analyze('selector-indirect.component.ts');
    const component = byName(meta.components, 'IndirectSelectorComponent');
    expect(component.selector).toBe('sb-indirect-chip');
  });

  it('omits selectors that are not statically resolvable', () => {
    const meta = analyze('selector-indirect.component.ts');
    expect(byName(meta.directives, 'DynamicSelectorDirective').selector).toBeUndefined();
    expect(byName(meta.components, 'NoSelectorComponent').selector).toBeUndefined();
  });
});

describe('inheritance', () => {
  it('blocks base members the child re-declares in a different bucket', () => {
    const meta = analyze('override-input.component.ts');
    const component = meta.components[0] as Directive;
    // The child re-declares the inherited `disabled` input as a plain property, so the base's
    // input entry (defaultValue 'true') must not shadow the child's runtime default.
    expect(component.inputsClass.map((input) => input.name)).not.toContain('disabled');
    expect(byName(component.propertiesClass, 'disabled')).toMatchObject({
      defaultValue: 'false',
    });
  });

  it('merges multi-level bases, child wins, d.ts bases contribute plain members', () => {
    const meta = analyze('inherit-chain.component.ts');
    const component = meta.components[0] as Directive;

    expect(component.inputsClass.map((input) => input.name)).toEqual(['midFlag', 'own']);
    expect(byName(component.inputsClass, 'midFlag')).toMatchObject({
      type: 'boolean',
      defaultValue: 'false',
    });

    // `hint` comes from MidBase (which itself overrides the d.ts base's declaration).
    expect(component.propertiesClass.map((property) => property.name)).toEqual(['hint']);
    expect(byName(component.propertiesClass, 'hint')).toMatchObject({ defaultValue: "'mid'" });

    // The child's own midHelper wins; helper comes best-effort from the declaration file.
    expect(component.methodsClass.map((method) => method.name)).toEqual(['helper', 'midHelper']);
    expect(byName(component.methodsClass, 'helper')).toMatchObject({
      args: [{ name: 'entry', type: 'string', optional: false }],
      returnType: 'number',
    });

    // MidBase itself is a plain-class record with its decorator IO split out.
    const midBase = byName(meta.classes, 'MidBase') as AngularClassMeta & {
      inputsClass?: Property[];
      methods: { name: string }[];
    };
    expect(midBase.inputsClass?.map((input) => input.name)).toEqual(['midFlag']);
    expect(midBase.methods.map((method) => method.name)).toEqual(['helper', 'midHelper']);
  });
});

describe('clarity-edges: real-world JSDoc, visibility, and type-text edge cases', () => {
  const component = () => analyze('clarity-edges.component.ts').components[0] as Directive;

  it('uses an explicit @description tag as the description, ignoring /***** garbage', () => {
    const cells = byName(component().inputsClass, 'cells');
    expect(cells.description).toBe('A query list of the cells in this row.');
    expect(cells.description).not.toContain('*');
  });

  it('carries jsdoctags on methods so @deprecated survives extraction', () => {
    const toggleNav = byName(component().methodsClass, 'toggleNav');
    const tagNames = (toggleNav.jsdoctags ?? []).map((tag) => tag.tagName?.escapedText);
    expect(tagNames).toContain('deprecated');

    const argTypes = extractArgTypesFromData(component(), {
      compodocJson: undefined as unknown as CompodocJson,
      ...ANALYZER_EXTRACT_OPTIONS,
    });
    expect(
      (argTypes as Record<string, { table?: { jsDocTags?: unknown } }>).toggleNav?.table?.jsDocTags
    ).toMatchObject({
      deprecated: 'Will be removed in v15. Use `openNav` instead.',
    });
  });

  it('drops undecorated private/protected accessor pairs but keeps public ones', () => {
    const names = component().propertiesClass.map((property) => property.name);
    expect(names).toContain('publicPair');
    expect(names).not.toContain('internalState');
    expect(names).not.toContain('errorPresent');
  });

  it('treats @Output() on a getter as an output, honoring the alias', () => {
    const outputs = component().outputsClass;
    const featuresClick = byName(outputs, 'featuresClick');
    expect(featuresClick.type).toBe('EventEmitter<number[]>');
    expect(featuresClick.description).toContain('Emitted when map features are clicked.');
    expect(outputs.map((output) => output.name)).toContain('renamedChange');

    const propertyNames = component().propertiesClass.map((property) => property.name);
    expect(propertyNames).not.toContain('featuresClick');
    expect(propertyNames).not.toContain('internalChange');
  });

  it('strips import() qualifiers from inferred method return types', () => {
    const listen = byName(component().methodsClass, 'listen');
    expect(listen.returnType).toBe('SubscriptionLike');
  });
});

describe('metadata-declared inputs/outputs (generated-wrapper style)', () => {
  const component = () => analyze('metadata-io.component.ts').components[0] as Directive;

  it('reclassifies fields named in the decorator inputs/outputs arrays', () => {
    const inputs = component().inputsClass;
    const disabled = byName(inputs, 'disabled');
    expect(disabled.description).toContain('Whether the component is disabled.');
    expect(byName(inputs, 'buttonDesign').type).toBe('"Default" | "Positive"');
    const state = byName(inputs, 'state');
    expect(state.required).toBe(true);
    expect(state.optional).toBe(false);
    expect(byName(component().outputsClass, 'click').type).toContain('EventEmitter');

    const propertyNames = component().propertiesClass.map((property) => property.name);
    expect(propertyNames).toEqual(['plainField']);
  });
});

describe('function-typed members keep their signature', () => {
  const component = () =>
    byName(analyze('metadata-io.component.ts').components, 'FunctionTypesComponent') as Directive;
  const inputs = () => component().inputsClass;

  it('renders parameters and return type instead of a bare "function"', () => {
    expect(byName(inputs(), 'format').type).toBe('(value: number, unit?: string) => string');
    expect(byName(inputs(), 'compare').type).toBe(
      '(a: { id: string }, b: { id: string }) => -1 | 0 | 1'
    );
    expect(byName(inputs(), 'collect').type).toBe('(...items: string[]) => void');
  });

  it('marks a constructor type with new, rather than flattening it to the same placeholder', () => {
    expect(byName(inputs(), 'factory').type).toBe('new (value: number) => Date');
  });

  it('keeps the function control the signature spelling would otherwise lose', () => {
    const argTypes = extractArgTypesFromData(component(), {
      compodocJson: undefined as unknown as CompodocJson,
      ...ANALYZER_EXTRACT_OPTIONS,
    }) as Record<string, { type?: { name?: string }; table?: { type?: { summary?: string } } }>;

    expect(argTypes.format?.type).toEqual({ name: 'function' });
    expect(argTypes.format?.table?.type?.summary).toBe('(value: number, unit?: string) => string');
    // A union with a function member is not itself a function signature; it must not claim to be.
    expect(argTypes.nullableCallback?.table?.type?.summary).toBe(
      '((value: string) => void) | null'
    );
  });
});
