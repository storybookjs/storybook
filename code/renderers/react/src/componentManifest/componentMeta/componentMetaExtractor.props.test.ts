import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extract, extractFromStory } from './componentMetaExtractor.test-helpers';

describe('prop extraction', () => {
  it('extracts basic prop types', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface ButtonProps {
          label: string;
          count: number;
          disabled?: boolean;
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' }, required: true },
        count: { type: { name: 'number' }, required: true },
        disabled: { required: false },
      },
    });
  });

  it('extracts string literal union as enum', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props {
          size: 'small' | 'medium' | 'large';
        }
        export const Button = (props: Props) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: {
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
          },
        },
      },
    });
  });

  it('extracts optional string literal union as enum', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props {
          size?: 'small' | 'medium' | 'large';
        }
        export const Button = (props: Props) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        size: {
          required: false,
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
          },
        },
      },
    });
  });

  it('extracts JSDoc descriptions', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props {
          /** The button label text */
          label: string;
          /** Whether the button is in primary style */
          primary?: boolean;
        }
        export const Button = (props: Props) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { description: 'The button label text' },
        primary: { description: 'Whether the button is in primary style' },
      },
    });
  });

  it('extracts component-level JSDoc description', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { label: string }
        /** Primary UI component for user interaction */
        export const Button = (props: Props) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      description: 'Primary UI component for user interaction',
    });
  });

  it('extracts Pick<> props correctly', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface FullProps {
          id: string;
          label: string;
          disabled: boolean;
          hidden: boolean;
        }
        type ButtonProps = Pick<FullProps, 'id' | 'label'>;
        export const Button = (props: ButtonProps) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: { id: { type: { name: 'string' } }, label: { type: { name: 'string' } } },
    });
  });

  it('extracts Omit<> props correctly', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface FullProps {
          id: string;
          label: string;
          internal: boolean;
        }
        type ButtonProps = Omit<FullProps, 'internal'>;
        export const Button = (props: ButtonProps) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: { id: { type: { name: 'string' } }, label: { type: { name: 'string' } } },
    });
  });

  it('extracts Partial<> props as all optional', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface FullProps {
          label: string;
          count: number;
        }
        export const Button = (props: Partial<FullProps>) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { required: false },
        count: { required: false },
      },
    });
  });

  it('extracts Required<> props as all required', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface OptionalProps {
          label?: string;
          count?: number;
        }
        export const Button = (props: Required<OptionalProps>) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { required: true },
        count: { required: true },
      },
    });
  });

  it('extracts extends interface props', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface BaseProps { id: string }
        interface ButtonProps extends BaseProps {
          label: string;
          variant?: 'primary' | 'secondary';
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        id: { parent: { name: 'BaseProps' } },
        label: { parent: { name: 'ButtonProps' } },
        variant: { parent: { name: 'ButtonProps' } },
      },
    });
  });

  it('extracts generic component props', async () => {
    const entry = await extract(
      'StringList',
      dedent`
        import React from 'react';
        interface ListProps<T> {
          items: T[];
          renderItem: (item: T) => React.ReactNode;
        }
        export const StringList = (props: ListProps<string>) => <ul />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        items: { type: { name: 'string[]' } },
        renderItem: { type: { name: '(item: string) => ReactNode' } },
      },
    });
  });

  it('flattens intersection types to all member props', async () => {
    const entry = await extract(
      'Comp',
      dedent`
        import React from 'react';
        interface A { x: string }
        interface B { y: number }
        export const Comp = (props: A & B) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        x: { type: { name: 'string' } },
        y: { type: { name: 'number' } },
      },
    });
  });

  it('flattens complex Pick & Omit combinations', async () => {
    const entry = await extract(
      'Comp',
      dedent`
        import React from 'react';
        interface Full { a: string; b: number; c: boolean; d: string }
        type Props = Pick<Full, 'a' | 'b' | 'c'> & Omit<{ extra: string; d: number }, 'd'>;
        export const Comp = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        a: { type: { name: 'string' } },
        b: { type: { name: 'number' } },
        c: { type: { name: 'boolean' } },
        extra: { type: { name: 'string' } },
      },
    });
    expect(entry.component?.reactComponentMeta?.props).not.toHaveProperty('d');
  });

  it('resolves generic instantiations to concrete prop types', async () => {
    const entry = await extract(
      'NumberList',
      dedent`
        import React from 'react';
        interface ListProps<T> {
          items: T[];
          selected?: T;
        }
        export const NumberList = (props: ListProps<number>) => <ul />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        items: { type: { name: 'number[]' } },
        selected: { type: { name: 'number' } },
      },
    });
  });

  it('extracts number literal union as enum', async () => {
    const entry = await extract(
      'Grid',
      dedent`
        import React from 'react';
        interface Props { columns: 1 | 2 | 3 | 4 }
        export const Grid = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        columns: {
          type: {
            name: 'enum',
            value: [{ value: '1' }, { value: '2' }, { value: '3' }, { value: '4' }],
          },
        },
      },
    });
  });

  it('extracts mixed union (string | number) as type string, not enum', async () => {
    const entry = await extract(
      'Input',
      dedent`
        import React from 'react';
        interface Props { value: string | number }
        export const Input = (props: Props) => <input />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        value: { type: { name: 'string | number' } },
      },
    });
  });

  it('preserves nested | undefined in optional props with generic types', async () => {
    const entry = await extract(
      'Widget',
      dedent`
        import React from 'react';
        type A = { a: string };
        type B = { b: number };
        interface Props {
          config?: Record<string, number | undefined>;
          onChange?: (value: string | undefined) => void;
          label: string;
          /** function type in a multi-member union - needs parens */
          handler?: ((x: number) => void) | string;
          /** intersection in a multi-member union - needs parens */
          combo?: (A & B) | string;
          /** boolean union with another type */
          boolOrStr?: boolean | string;
        }
        export const Widget = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        config: { type: { name: 'Record<string, number | undefined>' } },
        onChange: { type: { name: '(value: string | undefined) => void' } },
        label: { type: { name: 'string' } },
        handler: { type: { name: 'string | ((x: number) => void) | undefined' } },
        combo: { type: { name: 'string | (A & B) | undefined' } },
        boolOrStr: { type: { name: 'string | boolean | undefined' } },
      },
    });
  });

  it('extracts function prop types', async () => {
    const entry = await extract(
      'Form',
      dedent`
        import React from 'react';
        interface Props {
          onClick: () => void;
          onChange: (value: string) => void;
          onSubmit: (event: React.FormEvent) => Promise<void>;
        }
        export const Form = (props: Props) => <form />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        onClick: { type: { name: '() => void' } },
        onChange: { type: { name: '(value: string) => void' } },
        onSubmit: { type: { name: '(event: FormEvent<Element>) => Promise<void>' } },
      },
    });
  });

  it('extracts complex nested object props', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Theme {
          colors: { primary: string; secondary: string };
          spacing: number;
        }
        interface Props { theme: Theme; label: string }
        export const Button = (props: Props) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        theme: { type: { name: 'Theme' } },
        label: { type: { name: 'string' } },
      },
    });
  });

  it('extracts React.ReactNode and React.ReactElement prop types', async () => {
    const entry = await extract(
      'Card',
      dedent`
        import React from 'react';
        interface Props {
          children: React.ReactNode;
          icon: React.ReactElement;
          header?: React.ReactNode;
        }
        export const Card = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        children: { type: { name: 'ReactNode' } },
        icon: { type: { name: 'ReactElement<any, string | JSXElementConstructor<any>>' } },
        header: { type: { name: 'ReactNode' } },
      },
    });
  });

  it('filters out HTML attributes from extends (ButtonHTMLAttributes has >30 props)', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
          variant: 'primary' | 'secondary';
          label: string;
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: { variant: { required: true }, label: { required: true } },
    });
    // HTML attributes from ButtonHTMLAttributes should be filtered out (>30 props threshold)
    expect(entry.component?.reactComponentMeta?.props).not.toHaveProperty('onClick');
    expect(entry.component?.reactComponentMeta?.props).not.toHaveProperty('className');
  });

  it('keeps HTML attributes from extends when Pick narrows to few props', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        type ButtonProps = Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'type'> & {
          label: string;
        };
        export const Button = (props: ButtonProps) => <button />;
      `
    );

    // Under the threshold, HTML attrs are kept
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        disabled: { required: false },
        type: { required: false },
        label: { required: true },
      },
    });
  });

  it('extracts forwardRef component props', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { label: string; variant?: 'a' | 'b' }
        export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
          <button ref={ref} />
        ));
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' }, required: true },
        variant: {
          type: {
            name: 'enum',
            value: [{ value: '"a"' }, { value: '"b"' }],
          },
        },
      },
    });
  });

  it('includes ref and key props for forwardRef components', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { label: string }
        export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
          <button ref={ref} />
        ));
      `
    );

    // ref and key come from React internals, not from the user's Props interface
    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        ref: { parent: { name: 'RefAttributes' } },
        key: { parent: { name: 'Attributes' } },
      },
    });
  });

  it('collects all props from discriminated union', async () => {
    const entry = await extract(
      'Slider',
      dedent`
        import React from 'react';

        type ControlledProps = {
          value: number;
          defaultValue?: never;
        };

        type UncontrolledProps = {
          value?: never;
          defaultValue?: number;
        };

        type BaseProps = {
          min?: number;
          max?: number;
          step?: number;
        };

        type Props = BaseProps & (ControlledProps | UncontrolledProps);

        export const Slider: React.FC<Props> = (props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        defaultValue: { required: false },
        max: { required: false },
        min: { required: false },
        step: { required: false },
        value: { required: false },
      },
    });
  });

  it('forces optional when union variant lacks a prop entirely', async () => {
    const entry = await extract(
      'Alert',
      dedent`
        import React from 'react';
        type SuccessProps = { kind: 'success'; message: string; retryable?: never };
        type ErrorProps = { kind: 'error'; message: string; retryable: boolean };
        type Props = SuccessProps | ErrorProps;
        export const Alert: React.FC<Props> = (props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        kind: { required: true },
        message: { required: true },
        retryable: { required: false },
      },
    });
  });

  it('serializes tuple types', async () => {
    const entry = await extract(
      'Coord',
      dedent`
        import React from 'react';
        interface Props { point: [number, number]; label: string }
        export const Coord = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        point: { type: { name: '[number, number]' } },
        label: { type: { name: 'string' } },
      },
    });
  });

  it('serializes Record utility type', async () => {
    const entry = await extract(
      'Grid',
      dedent`
        import React from 'react';
        interface Props { cells: Record<string, number>; id: string }
        export const Grid = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        cells: { type: { name: 'Record<string, number>' } },
        id: { type: { name: 'string' } },
      },
    });
  });

  it('serializes template literal type', async () => {
    const entry = await extract(
      'Token',
      dedent`
        import React from 'react';
        type Color = 'red' | 'blue';
        interface Props { token: \`color-\${Color}\` }
        export const Token = (props: Props) => <span />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        token: {
          type: {
            name: 'enum',
            value: [{ value: '"color-red"' }, { value: '"color-blue"' }],
          },
        },
      },
    });
  });

  it('serializes indexed access type', async () => {
    const entry = await extract(
      'Comp',
      dedent`
        import React from 'react';
        interface Config { theme: { color: string; size: number } }
        interface Props { theme: Config['theme'] }
        export const Comp = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        theme: { type: { name: '{ color: string; size: number; }' } },
      },
    });
  });

  it('collapses true | false to boolean', async () => {
    const entry = await extract(
      'Toggle',
      dedent`
        import React from 'react';
        interface Props { on: true | false }
        export const Toggle = (props: Props) => <button />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        on: { type: { name: 'boolean' } },
      },
    });
  });

  it('serializes type alias wrapping interface', async () => {
    const entry = await extract(
      'Comp',
      dedent`
        import React from 'react';
        interface BaseProps { label: string; count: number }
        type Props = BaseProps;
        export const Comp = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' }, required: true },
        count: { type: { name: 'number' }, required: true },
      },
    });
  });

  it('serializes mapped type', async () => {
    const entry = await extract(
      'Comp',
      dedent`
        import React from 'react';
        type Flags<T extends string> = { [K in T]: boolean };
        type Props = Flags<'a' | 'b'>;
        export const Comp = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        a: { type: { name: 'boolean' }, required: true },
        b: { type: { name: 'boolean' }, required: true },
      },
    });
  });

  it('serializes conditional type in prop', async () => {
    const entry = await extract(
      'Comp',
      dedent`
        import React from 'react';
        type IsString<T> = T extends string ? true : false;
        interface Props { check: IsString<'hello'>; other: IsString<42> }
        export const Comp = (props: Props) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        check: { type: { name: 'true' } },
        other: { type: { name: 'false' } },
      },
    });
  });

  it('extracts props without meta.component (JSX + title matching)', async () => {
    const entry = await extractFromStory(
      {
        'jsx/Button.stories.tsx': dedent`
          import { Button } from './Button';
          export default {};
          export const Primary = () => <Button label="Click" />;
        `,
        'jsx/Button.tsx': dedent`
          import React from 'react';
          interface ButtonProps {
            /** The label */
            label: string;
            variant?: 'primary' | 'secondary';
          }
          export const Button = (props: ButtonProps) => <button />;
        `,
      },
      'jsx/Button.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Button',
      props: {
        label: {
          description: 'The label',
          type: { name: 'string' },
          required: true,
        },
        variant: {
          type: {
            name: 'enum',
            value: [{ value: '"primary"' }, { value: '"secondary"' }],
          },
          required: false,
        },
      },
    });
  });

  it('extracts default import without meta.component', async () => {
    const entry = await extractFromStory(
      {
        'jsx/Widget.stories.tsx': dedent`
          import Widget from './Widget';
          export default {};
          export const Default = () => <Widget title="Hello" />;
        `,
        'jsx/Widget.tsx': dedent`
          import React from 'react';
          interface Props { title: string; active?: boolean }
          const Widget = (props: Props) => <div />;
          export default Widget;
        `,
      },
      'jsx/Widget.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      displayName: 'Widget',
      props: {
        title: { type: { name: 'string' }, required: true },
        active: { required: false },
      },
    });
  });

  it('extracts { default as X } import without meta.component', async () => {
    const entry = await extractFromStory(
      {
        'jsx/Panel.stories.tsx': dedent`
          import { default as Panel } from './Panel';
          export default {};
          export const Open = () => <Panel title="Details" open />;
        `,
        'jsx/Panel.tsx': dedent`
          import React from 'react';
          interface Props { title: string; open?: boolean }
          export default (props: Props) => <div />;
        `,
      },
      'jsx/Panel.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        title: { type: { name: 'string' }, required: true },
        open: { required: false },
      },
    });
  });

  it('extracts namespace import without meta.component', async () => {
    const entry = await extractFromStory(
      {
        'jsx/ns/Accordion.stories.tsx': dedent`
          import * as Accordion from './Accordion';
          export default {};
          export const Basic = () => <Accordion.Root multiple />;
        `,
        'jsx/ns/Accordion.tsx': dedent`
          import React from 'react';
          interface RootProps { multiple?: boolean; defaultValue?: string }
          export const Root = (props: RootProps) => <div />;
        `,
      },
      'jsx/ns/Accordion.stories.tsx'
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        multiple: { required: false },
        defaultValue: { type: { name: 'string' } },
      },
    });
  });

  it('extracts satisfies expression component', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface Props { label: string; size?: 'sm' | 'md' }
        export const Button = ((props: Props) => <button />) satisfies React.FC<Props>;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' }, required: true },
        size: {
          type: {
            name: 'enum',
            value: [{ value: '"sm"' }, { value: '"md"' }],
          },
        },
      },
    });
  });

  it('extracts Readonly<> props', async () => {
    const entry = await extract(
      'Display',
      dedent`
        import React from 'react';
        interface Props { value: string; count: number }
        export const Display = (props: Readonly<Props>) => <div />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        value: { type: { name: 'string' }, required: true },
        count: { type: { name: 'number' }, required: true },
      },
    });
  });

  it('extracts array prop types', async () => {
    const entry = await extract(
      'List',
      dedent`
        import React from 'react';
        interface Props {
          items: string[];
          matrix: number[][];
          nodes: Array<React.ReactNode>;
        }
        export const List = (props: Props) => <ul />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        items: { type: { name: 'string[]' } },
        matrix: { type: { name: 'number[][]' } },
        nodes: { type: { name: 'ReactNode[]' } },
      },
    });
  });

  it('extracts enum type as enum', async () => {
    const entry = await extract(
      'Badge',
      dedent`
        import React from 'react';
        enum Status { Active = 'active', Inactive = 'inactive', Pending = 'pending' }
        interface Props { status: Status }
        export const Badge = (props: Props) => <span />;
      `
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        status: {
          type: {
            name: 'enum',
            value: [{ value: '"active"' }, { value: '"inactive"' }, { value: '"pending"' }],
          },
        },
      },
    });
  });
});
