import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extractFromStory } from './componentMetaExtractor.test-helpers';

describe('prop extraction via story JSX', () => {
  it('simple named export', async () => {
    const entry = await extractFromStory(
      {
        'path1/Button.tsx': dedent`
          import React from 'react';
          interface ButtonProps {
            /** The button label */
            label: string;
            variant?: 'solid' | 'outline';
            disabled?: boolean;
          }
          export const Button = (props: ButtonProps) => <button>{props.label}</button>;
        `,
        'path1/Button.stories.tsx': dedent`
          import React from 'react';
          import { Button } from './Button';
          export default { component: Button };
          export const Default = () => <Button label="Click me" variant="solid" />;
        `,
      },
      'path1/Button.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Button',
      exportName: 'Button',
      props: {
        label: {
          type: { name: 'string' },
          required: true,
          description: 'The button label',
          parent: { name: 'ButtonProps' },
        },
        variant: {
          type: { name: 'enum', value: [{ value: '"solid"' }, { value: '"outline"' }] },
          required: false,
          parent: { name: 'ButtonProps' },
        },
        disabled: {
          type: { name: 'boolean | undefined' },
          required: false,
          parent: { name: 'ButtonProps' },
        },
      },
    });
  });

  it('generic component (TypeScript resolves type parameters)', async () => {
    const entry = await extractFromStory(
      {
        'path1/GenericList.tsx': dedent`
          import React from 'react';
          interface ListProps<T> {
            /** The items to render */
            items: T[];
            /** Render function for each item */
            renderItem: (item: T) => React.ReactNode;
            /** Optional label above the list */
            title?: string;
          }
          export function GenericList<T>(props: ListProps<T>) {
            return <ul>{props.items.map(props.renderItem)}</ul>;
          }
        `,
        'path1/GenericList.stories.tsx': dedent`
          import React from 'react';
          import { GenericList } from './GenericList';
          export default { component: GenericList };
          export const StringList = () => (
            <GenericList items={['a', 'b']} renderItem={(s) => <li>{s}</li>} />
          );
        `,
      },
      'path1/GenericList.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'GenericList',
      exportName: 'GenericList',
      props: {
        items: {
          type: { name: 'string[]' },
          required: true,
          description: 'The items to render',
          parent: { name: 'ListProps' },
        },
        renderItem: {
          type: { name: '(item: string) => ReactNode' },
          required: true,
          description: 'Render function for each item',
          parent: { name: 'ListProps' },
        },
        title: {
          type: { name: 'string' },
          required: false,
          description: 'Optional label above the list',
          parent: { name: 'ListProps' },
        },
      },
    });
  });

  it('forwardRef component', async () => {
    const entry = await extractFromStory(
      {
        'path1/ForwardRefButton.tsx': dedent`
          import React from 'react';
          interface FRButtonProps {
            /** Button text */
            text: string;
            size?: 'sm' | 'md' | 'lg';
          }
          export const ForwardRefButton = React.forwardRef<HTMLButtonElement, FRButtonProps>(
            (props, ref) => <button ref={ref}>{props.text}</button>
          );
        `,
        'path1/ForwardRefButton.stories.tsx': dedent`
          import React from 'react';
          import { ForwardRefButton } from './ForwardRefButton';
          export default { component: ForwardRefButton };
          export const Default = () => <ForwardRefButton text="Hello" size="md" />;
        `,
      },
      'path1/ForwardRefButton.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'ForwardRefButton',
      exportName: 'ForwardRefButton',
      props: {
        text: {
          type: { name: 'string' },
          required: true,
          description: 'Button text',
          parent: { name: 'FRButtonProps' },
        },
        size: {
          type: { name: 'enum', value: [{ value: '"md"' }, { value: '"sm"' }, { value: '"lg"' }] },
          required: false,
          parent: { name: 'FRButtonProps' },
        },
        key: {
          type: { name: 'Key | null | undefined' },
          required: false,
          parent: { name: 'Attributes' },
        },
        ref: {
          type: { name: 'LegacyRef<HTMLButtonElement> | undefined' },
          required: false,
          parent: { name: 'RefAttributes' },
        },
      },
    });
  });

  it('memo component', async () => {
    const entry = await extractFromStory(
      {
        'path1/MemoButton.tsx': dedent`
          import React from 'react';
          interface MemoButtonProps {
            /** The label */
            label: string;
            color?: string;
          }
          const Inner = (props: MemoButtonProps) => <button>{props.label}</button>;
          export const MemoButton = React.memo(Inner);
        `,
        'path1/MemoButton.stories.tsx': dedent`
          import React from 'react';
          import { MemoButton } from './MemoButton';
          export default { component: MemoButton };
          export const Default = () => <MemoButton label="Click" color="blue" />;
        `,
      },
      'path1/MemoButton.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'MemoButton',
      exportName: 'MemoButton',
      props: {
        label: {
          type: { name: 'string' },
          required: true,
          description: 'The label',
          parent: { name: 'MemoButtonProps' },
        },
        color: {
          type: { name: 'string' },
          required: false,
          parent: { name: 'MemoButtonProps' },
        },
      },
    });
  });

  it('compound component member (Accordion.Root)', async () => {
    const entry = await extractFromStory(
      {
        'path1/Compound.tsx': dedent`
          import React from 'react';
          interface RootProps {
            /** Whether multiple items can be open */
            multiple?: boolean;
          }
          /**
           * Compound root description
           * @summary Compound root summary
           */
          const Root = ({ multiple = true }: RootProps) => <div data-multiple={multiple} />;
          interface ItemProps {
            value: string;
            disabled?: boolean;
          }
          const Item = (props: ItemProps) => <div />;
          export const Accordion = { Root, Item };
        `,
        'path1/Compound.stories.tsx': dedent`
          import React from 'react';
          import { Accordion } from './Compound';
          export default {};
          export const Default = () => (
            <Accordion.Root multiple>
              <Accordion.Item value="a" />
            </Accordion.Root>
          );
        `,
      },
      'path1/Compound.stories.tsx',
      { componentName: 'Accordion.Root' }
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Accordion.Root',
      exportName: 'Accordion',
      description: 'Compound root description',
      jsDocTags: {
        summary: ['Compound root summary'],
      },
      props: {
        multiple: {
          type: { name: 'boolean | undefined' },
          required: false,
          description: 'Whether multiple items can be open',
          defaultValue: { value: 'true' },
          parent: { name: 'RootProps' },
        },
      },
    });
  });

  it('namespace import (Popover.Panel)', async () => {
    const entry = await extractFromStory(
      {
        'path1/NamespaceCompound.tsx': dedent`
          import React from 'react';
          interface PanelProps {
            /** Whether the panel is open */
            open?: boolean;
            label: string;
          }
          /**
           * Panel description
           * @summary Panel summary
           */
          export const Panel = ({ open = false, label }: PanelProps) => <div data-open={open}>{label}</div>;
          interface TriggerProps {
            onClick: () => void;
          }
          export const Trigger = (props: TriggerProps) => <button />;
        `,
        'path1/NamespaceCompound.stories.tsx': dedent`
          import React from 'react';
          import * as Popover from './NamespaceCompound';
          export default {};
          export const Default = () => <Popover.Panel open label="hello" />;
        `,
      },
      'path1/NamespaceCompound.stories.tsx',
      { componentName: 'Popover.Panel' }
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Popover.Panel',
      exportName: 'Panel',
      description: 'Panel description',
      jsDocTags: {
        summary: ['Panel summary'],
      },
      props: {
        label: {
          type: { name: 'string' },
          required: true,
          parent: { name: 'PanelProps' },
        },
        open: {
          type: { name: 'boolean | undefined' },
          required: false,
          description: 'Whether the panel is open',
          defaultValue: { value: 'false' },
          parent: { name: 'PanelProps' },
        },
      },
    });
  });

  it('default-export attached member (Button.Aligner)', async () => {
    const entry = await extractFromStory(
      {
        'path1/AttachedMember.tsx': dedent`
          import React from 'react';
          interface ButtonProps {
            variant?: 'solid' | 'outline';
          }
          const Button = (props: ButtonProps) => <button />;

          interface AlignerProps {
            /** Side to align */
            side?: 'start' | 'end';
          }

          /**
           * Aligner description
           * @summary Aligner summary
           */
          const Aligner = ({ side = 'start' }: AlignerProps) => <div data-side={side} />;

          const ButtonRoot = Button as typeof Button & {
            Aligner: typeof Aligner;
          };
          ButtonRoot.Aligner = Aligner;

          export default ButtonRoot;
        `,
        'path1/AttachedMember.stories.tsx': dedent`
          import React from 'react';
          import Button from './AttachedMember';
          export default { component: Button };
          export const Default = () => <Button.Aligner />;
        `,
      },
      'path1/AttachedMember.stories.tsx',
      { componentName: 'Button.Aligner' }
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Button.Aligner',
      exportName: 'default',
      description: 'Aligner description',
      jsDocTags: {
        summary: ['Aligner summary'],
      },
      props: {
        side: {
          type: { name: 'enum', value: [{ value: '"start"' }, { value: '"end"' }] },
          required: false,
          description: 'Side to align',
          defaultValue: { value: "'start'" },
          parent: { name: 'AlignerProps' },
        },
      },
    });
  });

  it('default export', async () => {
    const entry = await extractFromStory(
      {
        'path1/DefaultExport.tsx': dedent`
          import React from 'react';
          interface HeaderProps {
            /** The title text */
            title: string;
            subtitle?: string;
          }
          const Header = (props: HeaderProps) => <header>{props.title}</header>;
          export default Header;
        `,
        'path1/DefaultExport.stories.tsx': dedent`
          import React from 'react';
          import Header from './DefaultExport';
          export default { component: Header };
          export const Default = () => <Header title="Welcome" subtitle="Hi" />;
        `,
      },
      'path1/DefaultExport.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Header',
      exportName: 'default',
      props: {
        title: {
          type: { name: 'string' },
          required: true,
          description: 'The title text',
          parent: { name: 'HeaderProps' },
        },
        subtitle: {
          type: { name: 'string' },
          required: false,
          parent: { name: 'HeaderProps' },
        },
      },
    });
  });
});
