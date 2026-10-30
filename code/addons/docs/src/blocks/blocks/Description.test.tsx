// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import React from 'react';
import type { DocsContextProps, DocgenPayload } from 'storybook/internal/types';
import { ThemeProvider, convert, themes } from 'storybook/theming';

import { Description } from './Description.tsx';
import { DocsContext } from './DocsContext.ts';
import { useServiceDocgen } from './use-service-docgen.ts';

vi.mock('./use-service-docgen.ts', () => ({ useServiceDocgen: vi.fn() }));
vi.mock('./mdx', () => ({
  CodeOrSourceMdx: ({ children }: { children: string }) => <code>{children}</code>,
  AnchorMdx: () => null,
  HeadersMdx: {},
}));

const ButtonComponent = () => null;

const renderDescription = (payload: DocgenPayload, componentDescription?: string) => {
  vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
  vi.mocked(useServiceDocgen).mockReturnValue({ data: payload } as ReturnType<
    typeof useServiceDocgen
  >);
  const context = {
    resolveOf: () => ({
      type: 'component',
      component: ButtonComponent,
      projectAnnotations: {
        parameters: {
          docs: {
            extractComponentDescription: componentDescription
              ? () => componentDescription
              : undefined,
          },
        },
      },
    }),
    getComponentId: () => payload.id,
  } as unknown as DocsContextProps;

  return render(
    <ThemeProvider theme={convert(themes.light)}>
      <DocsContext.Provider value={context}>
        <Description of={ButtonComponent} />
      </DocsContext.Provider>
    </ThemeProvider>
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('renders a fenced Angular @example in a component Description', () => {
  const { container } = renderDescription({
    id: 'button',
    name: 'ButtonComponent',
    path: './button.stories.ts',
    renderer: 'angular',
    description: 'A button.',
    jsDocTags: { example: ['```html\n<sb-button label="Save" />\n```'] },
  });

  expect(container.textContent).toContain('A button.');
  expect(container.querySelectorAll('pre code')).toHaveLength(1);
  expect(container.querySelector('pre code')?.textContent).toBe('<sb-button label="Save" />\n');
});

it('renders an unfenced Angular @example as code', () => {
  const { container } = renderDescription({
    id: 'button',
    name: 'ButtonComponent',
    path: './button.stories.ts',
    renderer: 'angular',
    description: 'A button.',
    jsDocTags: { example: ['<sb-button label="Save" />'] },
  });

  expect(container.querySelectorAll('pre code')).toHaveLength(1);
  expect(container.querySelector('pre code')?.textContent).toBe('<sb-button label="Save" />\n');
});

it('does not append examples from other renderers', () => {
  const { container } = renderDescription({
    id: 'button',
    name: 'ButtonComponent',
    path: './button.stories.ts',
    renderer: 'react',
    description: 'A button.',
    jsDocTags: { example: ['<Button />'] },
  });

  expect(container.textContent).toBe('A button.');
});

it('renders every Angular example when the component has no description prose', () => {
  const { container } = renderDescription({
    id: 'button',
    name: 'ButtonComponent',
    path: './button.stories.ts',
    renderer: 'angular',
    jsDocTags: { example: ['<sb-button />', '<sb-button disabled />'] },
  });

  expect(container.querySelectorAll('pre code')).toHaveLength(2);
  expect(Array.from(container.querySelectorAll('pre code'), (code) => code.textContent)).toEqual([
    '<sb-button />\n',
    '<sb-button disabled />\n',
  ]);
});

it('keeps an explicit component description override ahead of Angular examples', () => {
  const { container } = renderDescription(
    {
      id: 'button',
      name: 'ButtonComponent',
      path: './button.stories.ts',
      renderer: 'angular',
      description: 'Generated description.',
      jsDocTags: { example: ['<sb-button />'] },
    },
    'Custom description.'
  );

  expect(container.textContent).toBe('Custom description.');
});
