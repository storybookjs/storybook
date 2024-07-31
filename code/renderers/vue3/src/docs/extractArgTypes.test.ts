import { extractComponentProps, hasDocgen } from 'storybook/internal/docs-tools';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi, vitest } from 'vitest';
import { extractArgTypes } from './extractArgTypes';
import {
  mockExtractComponentEventsReturn,
  mockExtractComponentPropsReturn,
  mockExtractComponentSlotsReturn,
  referenceTypeEvents,
  referenceTypeProps,
  templateSlots,
  vueDocgenMocks,
} from './tests-meta-components/meta-components';

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
