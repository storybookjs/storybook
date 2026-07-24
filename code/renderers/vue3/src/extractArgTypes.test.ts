import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi, vitest } from 'vitest';

import { extractComponentProps, hasDocgen } from 'storybook/internal/docs-tools';

import {
  mockExtractComponentEventsReturn,
  mockExtractComponentPropsReturn,
  mockExtractComponentSlotsReturn,
  referenceTypeEvents,
  referenceTypeProps,
  templateSlots,
  vueDocgenMocks,
} from './docs/tests-meta-components/meta-components.ts';
import { convertVueComponentMetaProp, extractArgTypes } from './extractArgTypes.ts';

vitest.mock('storybook/internal/docs-tools', async (importOriginal) => {
  const module: Record<string, unknown> = await importOriginal();
  return {
    ...module,
    extractComponentProps: vi.fn(),
    hasDocgen: vi.fn(),
  };
});

describe('extractArgTypes (vue-docgen-api)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return null if component does not contain docs', () => {
    (hasDocgen as unknown as Mock).mockReturnValueOnce(false);
    (extractComponentProps as Mock).mockReturnValueOnce([] as any);

    expect(extractArgTypes({} as any)).toBeNull();
  });

  it('should extract props for component', () => {
    const component = referenceTypeProps;
    (hasDocgen as unknown as Mock).mockReturnValueOnce(true);

    (extractComponentProps as Mock).mockImplementation((_, section) => {
      return section === 'props' ? mockExtractComponentPropsReturn : [];
    });

    const argTypes = extractArgTypes(component);

    expect(argTypes).toMatchSnapshot();
  });

  it('should extract events for Vue component', () => {
    const component = referenceTypeEvents;
    (hasDocgen as unknown as Mock).mockReturnValueOnce(true);
    (extractComponentProps as Mock).mockImplementation((_, section) => {
      return section === 'events' ? mockExtractComponentEventsReturn : [];
    });

    const argTypes = extractArgTypes(component);

    expect(argTypes).toMatchSnapshot();
  });

  it('should extract slots type for Vue component', () => {
    const component = templateSlots;
    (hasDocgen as unknown as Mock).mockReturnValueOnce(true);
    (extractComponentProps as Mock).mockImplementation((_, section) => {
      return section === 'slots' ? mockExtractComponentSlotsReturn : [];
    });

    const argTypes = extractArgTypes(component);

    expect(argTypes).toMatchSnapshot();
  });
});

describe('extractArgTypes (vue-docgen-api)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should extract props for component', async () => {
    const component = vueDocgenMocks.props.component;
    (hasDocgen as unknown as Mock).mockReturnValueOnce(true);

    (extractComponentProps as Mock).mockImplementation((_, section) => {
      return section === 'props' ? vueDocgenMocks.props.extractedProps : [];
    });

    const argTypes = extractArgTypes(component);

    expect(argTypes).toMatchSnapshot();
  });

  it('should extract events for component', async () => {
    const component = vueDocgenMocks.events.component;
    (hasDocgen as unknown as Mock).mockReturnValueOnce(true);

    (extractComponentProps as Mock).mockImplementation((_, section) => {
      return section === 'events' ? vueDocgenMocks.events.extractedProps : [];
    });

    const argTypes = extractArgTypes(component);

    expect(argTypes).toMatchSnapshot();
  });

  it('should extract slots for component', async () => {
    const component = vueDocgenMocks.slots.component;
    (hasDocgen as unknown as Mock).mockReturnValueOnce(true);

    (extractComponentProps as Mock).mockImplementation((_, section) => {
      return section === 'slots' ? vueDocgenMocks.slots.extractedProps : [];
    });

    const argTypes = extractArgTypes(component);

    expect(argTypes).toMatchSnapshot();
  });

  it('should extract expose for component', async () => {
    const component = vueDocgenMocks.expose.component;
    (hasDocgen as unknown as Mock).mockReturnValueOnce(true);

    (extractComponentProps as Mock).mockImplementation((_, section) => {
      return section === 'expose' ? vueDocgenMocks.expose.extractedProps : [];
    });

    const argTypes = extractArgTypes(component);

    expect(argTypes).toMatchSnapshot();
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

  it('should not convert TS enum member references to an enum sbType', () => {
    // the schema only carries the member names, not their runtime values; an enum
    // sbType would make Controls inject the name string instead of the value
    expect(
      convertVueComponentMetaProp({
        type: 'Severity',
        required: true,
        schema: {
          kind: 'enum',
          type: 'Severity',
          schema: ['Severity.Info', 'Severity.Warning', 'Severity.Error'],
        },
      })
    ).toEqual({ name: 'other', value: 'Severity', required: true });
  });

  it('should not convert numeric TS enum member references either', () => {
    expect(
      convertVueComponentMetaProp({
        type: 'Level | undefined',
        required: false,
        schema: {
          kind: 'enum',
          type: 'Level | undefined',
          schema: ['undefined', 'Level.Low', 'Level.High'],
        },
      })
    ).toEqual({ name: 'other', value: 'Level | undefined', required: false });
  });
});
