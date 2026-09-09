import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi, vitest } from 'vitest';

import { extractComponentProps, hasDocgen } from 'storybook/internal/docs-tools';
import { inferControls } from 'storybook/internal/preview-api';

import {
  convertVueComponentMetaProp,
  extractArgTypes,
  extractFromVueComponentMeta,
} from './extractArgTypes.ts';
import type { VueDocgenInfoEntry } from './types.ts';

vitest.mock('storybook/internal/docs-tools', async (importOriginal) => {
  const module: Record<string, unknown> = await importOriginal();
  return {
    ...module,
    extractComponentProps: vi.fn(),
    hasDocgen: vi.fn(),
  };
});

// What each engine extracts from a real component is recorded per fixture in
// @storybook/docgen-harness, which runs both Vue docgen pipelines end to end. Only the
// docgen-less guard is unit-tested here, because no fixture can produce it.
describe('extractArgTypes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return null if component does not contain docs', () => {
    (hasDocgen as unknown as Mock).mockReturnValueOnce(false);
    (extractComponentProps as Mock).mockReturnValueOnce([] as any);

    expect(extractArgTypes({} as any)).toBeNull();
  });

  it('should pass the named-type resolver only to the vue-component-meta extraction', () => {
    (hasDocgen as unknown as Mock).mockReturnValue(true);
    const propMeta = {
      name: 'user',
      type: 'User | undefined',
      required: false,
      schema: { kind: 'object', type: 'User' },
      description: '',
      tags: [],
    } as unknown as VueDocgenInfoEntry<'vue-component-meta', 'props'>;
    (extractComponentProps as Mock).mockImplementation((_component: unknown, section: string) =>
      section === 'props' ? [{ docgenInfo: propMeta }] : []
    );
    const resolveNamedTypeDetail = vi.fn(() => 'User {\n  name: string\n}');

    const argTypes = extractArgTypes(
      { __docgenInfo: { props: [propMeta], exposed: [] } } as any,
      resolveNamedTypeDetail
    );

    expect(resolveNamedTypeDetail).toHaveBeenCalledWith('User');
    expect(argTypes?.user?.table?.type).toEqual({
      summary: 'User',
      detail: 'User {\n  name: string\n}',
    });
  });

  it('should not invoke the named-type resolver for the legacy vue-docgen-api extraction', () => {
    (hasDocgen as unknown as Mock).mockReturnValue(true);
    const doc = {
      name: 'user',
      type: { name: 'string' },
      required: false,
      description: '',
    } as unknown as VueDocgenInfoEntry<'vue-docgen-api', 'props'>;
    (extractComponentProps as Mock).mockImplementation((_component: unknown, section: string) =>
      section === 'props' ? [{ docgenInfo: doc, propDef: { defaultValue: undefined } }] : []
    );
    const resolveNamedTypeDetail = vi.fn(() => 'should never be used');

    const argTypes = extractArgTypes(
      { __docgenInfo: { props: [doc] } } as any,
      resolveNamedTypeDetail
    );

    expect(resolveNamedTypeDetail).not.toHaveBeenCalled();
    expect(argTypes?.user?.table?.type).toEqual({ summary: 'string' });
  });
});

describe('extractFromVueComponentMeta named-type detail', () => {
  const propInfo = {
    name: 'user',
    type: 'User | undefined',
    required: false,
    schema: { kind: 'object', type: 'User' },
    description: '',
    tags: [],
  } as unknown as VueDocgenInfoEntry<'vue-component-meta', 'props'>;

  it('should emit the resolver text as table.type.detail alongside the summary', () => {
    const argType = extractFromVueComponentMeta(
      propInfo,
      'props',
      () => 'User {\n  name: string\n}'
    );

    expect(argType?.table?.type).toEqual({ summary: 'User', detail: 'User {\n  name: string\n}' });
  });

  it('should leave the detail key absent when the resolver returns undefined', () => {
    const argType = extractFromVueComponentMeta(propInfo, 'props', () => undefined);

    expect(argType?.table?.type).toEqual({ summary: 'User' });
  });

  it('should leave the table untouched when no resolver is injected (legacy path)', () => {
    const argType = extractFromVueComponentMeta(propInfo, 'props');

    expect(argType?.table?.type).toEqual({ summary: 'User' });
  });

  it('should never resolve details for events and other non-prop sections', () => {
    const eventInfo = {
      name: 'change',
      type: 'User',
    } as unknown as VueDocgenInfoEntry<'vue-component-meta', 'events'>;
    const resolveNamedTypeDetail = vi.fn(() => 'should never be used');

    extractFromVueComponentMeta(eventInfo, 'events', resolveNamedTypeDetail);

    expect(resolveNamedTypeDetail).not.toHaveBeenCalled();
  });
});

describe('convertVueComponentMetaProp', () => {
  it('should convert a literal union schema to an enum sbType with its values', () => {
    expect(
      convertVueComponentMetaProp({
        type: '"small" | "medium" | "large"',
        required: true,
        schema: {
          kind: 'enum',
          type: '"small" | "medium" | "large"',
          schema: ['"small"', '"medium"', '"large"'],
        },
      })
    ).toEqual({ name: 'enum', value: ['small', 'medium', 'large'], required: true });
  });

  it('should convert TS enum members to an enum sbType of their runtime values', () => {
    expect(
      convertVueComponentMetaProp({
        type: 'Severity',
        required: true,
        schema: {
          kind: 'enum',
          type: 'Severity',
          schema: [
            { kind: 'literal', type: 'Severity.Info', value: '"info"' },
            { kind: 'literal', type: 'Severity.Warning', value: '"warning"' },
            { kind: 'literal', type: 'Severity.Error', value: '"error"' },
          ],
        },
      })
    ).toEqual({ name: 'enum', value: ['info', 'warning', 'error'], required: true });
  });

  it('should keep numeric TS enum members numeric', () => {
    expect(
      convertVueComponentMetaProp({
        type: 'Level | undefined',
        required: false,
        schema: {
          kind: 'enum',
          type: 'Level | undefined',
          schema: [
            'undefined',
            { kind: 'literal', type: 'Level.Low', value: '0' },
            { kind: 'literal', type: 'Level.High', value: '1' },
          ],
        },
      })
    ).toEqual({ name: 'enum', value: [0, 1], required: false });
  });

  it('should convert a union mixing TS enum members and string literals', () => {
    expect(
      convertVueComponentMetaProp({
        type: 'Severity | "custom"',
        required: true,
        schema: {
          kind: 'enum',
          type: 'Severity | "custom"',
          schema: [{ kind: 'literal', type: 'Severity.Info', value: '"info"' }, '"custom"'],
        },
      })
    ).toEqual({ name: 'enum', value: ['info', 'custom'], required: true });
  });

  it('should not convert qualified type names that stand for no value', () => {
    // "typeof Config.alpha" stringifies with a dot but carries nothing selectable;
    // an enum sbType would make Controls inject that name verbatim
    expect(
      convertVueComponentMetaProp({
        type: 'typeof Config.alpha | typeof Config.beta',
        required: true,
        schema: {
          kind: 'enum',
          type: 'typeof Config.alpha | typeof Config.beta',
          schema: ['typeof Config.alpha', 'typeof Config.beta'],
        },
      })
    ).toEqual({
      name: 'other',
      value: 'typeof Config.alpha | typeof Config.beta',
      required: true,
    });
  });
});

describe('extractFromVueComponentMeta', () => {
  const propInfo = (overrides: Record<string, unknown>) =>
    ({
      name: 'severity',
      global: false,
      description: '',
      tags: [],
      required: true,
      ...overrides,
    }) as any;

  it('should label TS enum options with the member names they are written as', () => {
    const argType = extractFromVueComponentMeta(
      propInfo({
        type: 'Severity',
        schema: {
          kind: 'enum',
          type: 'Severity',
          schema: [
            { kind: 'literal', type: 'Severity.Info', value: '"info"' },
            { kind: 'literal', type: 'Severity.Warning', value: '"warning"' },
          ],
        },
      }),
      'props'
    );

    expect(argType).toMatchObject({
      type: { name: 'enum', value: ['info', 'warning'] },
      options: ['info', 'warning'],
      control: { labels: { info: 'Severity.Info', warning: 'Severity.Warning' } },
      // the docs table documents the enum, not the values behind it
      table: { type: { summary: 'Severity' } },
    });
  });

  it('should hand Controls a labelled option set once inferControls has run', () => {
    // the labels are only useful if they survive next to the control type inferControls picks,
    // which is what lets a TS enum reach the same radio/select treatment as a literal union
    const argType = extractFromVueComponentMeta(
      propInfo({
        type: 'Severity',
        schema: {
          kind: 'enum',
          type: 'Severity',
          schema: [
            { kind: 'literal', type: 'Severity.Info', value: '"info"' },
            { kind: 'literal', type: 'Severity.Warning', value: '"warning"' },
          ],
        },
      }),
      'props'
    );

    const inferred = inferControls({
      argTypes: { severity: argType } as any,
      parameters: { __isArgsStory: true } as any,
    });

    expect(inferred.severity).toMatchObject({
      control: {
        type: 'radio',
        labels: { info: 'Severity.Info', warning: 'Severity.Warning' },
      },
      options: ['info', 'warning'],
    });
  });

  it('should leave a plain literal union unlabelled', () => {
    const argType = extractFromVueComponentMeta(
      propInfo({
        name: 'size',
        type: '"small" | "large"',
        schema: { kind: 'enum', type: '"small" | "large"', schema: ['"small"', '"large"'] },
      }),
      'props'
    );

    expect(argType).toEqual({
      name: 'size',
      description: '',
      defaultValue: undefined,
      type: { name: 'enum', value: ['small', 'large'], required: true },
      table: {
        type: { summary: '"small" | "large"' },
        defaultValue: undefined,
        category: 'props',
      },
    });
  });
});
