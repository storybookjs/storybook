import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractFromStory } from './componentMetaExtractor.test-helpers.ts';

const COMPONENT = dedent`
  import React from 'react';
  interface MyComponentProps {
    /** The content to render */
    children: React.ReactNode;
    /** Visual emphasis */
    emphasis?: 'low' | 'high';
  }
  export function MyComponent({ children, emphasis }: MyComponentProps) {
    return <div data-emphasis={emphasis}>{children}</div>;
  }
`;

const EXPECTED_META = {
  displayName: 'MyComponent',
  exportName: 'MyComponent',
  props: {
    children: {
      required: true,
      description: 'The content to render',
      parent: { name: 'MyComponentProps' },
    },
    emphasis: {
      type: { name: 'enum', value: [{ value: '"low"' }, { value: '"high"' }] },
      required: false,
      parent: { name: 'MyComponentProps' },
    },
  },
};

describe('prop extraction for CSF4 preview.meta() stories', () => {
  // An args-only story has no JSX of the component anywhere in the file (Path 1 cannot resolve)
  // and a CSF4 meta is a local `const`, not a default export (Path 2 cannot resolve). The component
  // file + export name are still known from the story's imports, so props must resolve from there.
  it('extracts props for an args-only story (no render, no JSX)', async () => {
    const entry = await extractFromStory(
      {
        'csf4/MyComponent.tsx': COMPONENT,
        'csf4/MyComponent.stories.tsx': dedent`
          import preview from '#.storybook/preview';
          import { MyComponent } from './MyComponent';
          const meta = preview.meta({ component: MyComponent });
          export const ArgsOnly = meta.story({ args: { children: 'Hello' } });
        `,
      },
      'csf4/MyComponent.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject(EXPECTED_META);
  });

  // The existing JSX path must keep working for stories that do render the component.
  it('extracts props for a story with an explicit render (JSX path)', async () => {
    const entry = await extractFromStory(
      {
        'csf4/MyComponent.tsx': COMPONENT,
        'csf4/MyComponent.stories.tsx': dedent`
          import React from 'react';
          import preview from '#.storybook/preview';
          import { MyComponent } from './MyComponent';
          const meta = preview.meta({ component: MyComponent });
          export const WithRender = meta.story({
            args: { children: 'Hello' },
            render: (args) => <MyComponent {...args} />,
          });
        `,
      },
      'csf4/MyComponent.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject(EXPECTED_META);
  });

  // Mirrors the issue reproduction exactly: a declaration-merged component (function + namespace)
  // whose props extend HTMLAttributes, in an args-only CSF4 story.
  it('extracts props for a declaration-merged component (issue repro shape)', async () => {
    const entry = await extractFromStory(
      {
        'csf4/MergedComponent.tsx': dedent`
          import type { HTMLAttributes, ReactNode } from 'react';
          export namespace MergedComponent {
            export interface Props extends HTMLAttributes<HTMLDivElement> {
              /** The content to render */
              children: ReactNode;
            }
          }
          export function MergedComponent({ children, ...rest }: MergedComponent.Props) {
            return <div {...rest}>{children}</div>;
          }
        `,
        'csf4/MergedComponent.stories.tsx': dedent`
          import preview from '#.storybook/preview';
          import { MergedComponent } from './MergedComponent';
          const meta = preview.meta({ component: MergedComponent });
          export const ArgsOnly = meta.story({ args: { children: 'Hello' } });
        `,
      },
      'csf4/MergedComponent.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'MergedComponent',
      exportName: 'MergedComponent',
      props: {
        children: {
          required: true,
          description: 'The content to render',
        },
      },
    });
  });
});
