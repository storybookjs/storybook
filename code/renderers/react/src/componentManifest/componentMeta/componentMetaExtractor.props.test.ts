import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import {
  extract,
  extractFromStory,
  extractFromStoryWithConfig,
} from './componentMetaExtractor.test-helpers.ts';
import { DEFAULT_TSCONFIG } from './test-helpers.ts';

/** The shared default tsconfig plus allowJs, so untyped .jsx components join the program. */
const JS_TSCONFIG = {
  ...DEFAULT_TSCONFIG,
  compilerOptions: { ...DEFAULT_TSCONFIG.compilerOptions, allowJs: true },
  include: [...DEFAULT_TSCONFIG.include, './**/*.js', './**/*.jsx'],
};

describe('prop extraction', () => {
  it('leaves out a prop marked @ignore, like builder docgen did', async () => {
    const entry = await extract(
      'Button',
      dedent`
        import React from 'react';
        interface ButtonProps {
          /** Shown. */
          label: string;
          /**
           * Should not be visible since it's ignored.
           *
           * @ignore
           */
          internal: string;
        }
        export const Button = (props: ButtonProps) => <button />;
      `
    );

    expect(Object.keys(entry.component?.reactComponentMeta?.props ?? {})).toEqual(['label']);
  });

  describe('basic types', () => {
    it('extracts string, number, and boolean props', async () => {
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

    it('extracts nested object props', async () => {
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

    it('extracts React.ReactNode and React.ReactElement', async () => {
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

    it('extracts tuple, Record, and indexed access types', async () => {
      const entry = await extract(
        'Comp',
        dedent`
          import React from 'react';
          interface Config { theme: { color: string; size: number } }
          interface Props {
            point: [number, number];
            cells: Record<string, number>;
            theme: Config['theme'];
          }
          export const Comp = (props: Props) => <div />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: {
          point: { type: { name: '[number, number]' } },
          cells: { type: { name: 'Record<string, number>' } },
          theme: { type: { name: '{ color: string; size: number; }' } },
        },
      });
    });
  });

  describe('union types', () => {
    it('extracts string literal union as enum', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface Props { size: 'small' | 'medium' | 'large' }
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
          interface Props { size?: 'small' | 'medium' | 'large' }
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

    it('extracts TypeScript enum as enum', async () => {
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

    it('extracts template literal type as enum', async () => {
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

    it('extracts mixed union as type string, not enum', async () => {
      const entry = await extract(
        'Input',
        dedent`
          import React from 'react';
          interface Props { value: string | number }
          export const Input = (props: Props) => <input />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: { value: { type: { name: 'string | number' } } },
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
        props: { on: { type: { name: 'boolean' } } },
      });
    });

    it('preserves nested | undefined in optional multi-member unions', async () => {
      const entry = await extract(
        'Widget',
        dedent`
          import React from 'react';
          type A = { a: string };
          type B = { b: number };
          interface Props {
            config?: Record<string, number | undefined>;
            onChange?: (value: string | undefined) => void;
            handler?: ((x: number) => void) | string;
            combo?: (A & B) | string;
          }
          export const Widget = (props: Props) => <div />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: {
          config: { type: { name: 'Record<string, number | undefined>' } },
          onChange: { type: { name: '(value: string | undefined) => void' } },
          handler: { type: { name: 'string | ((x: number) => void) | undefined' } },
          combo: { type: { name: 'string | (A & B) | undefined' } },
        },
      });
    });

    it('collects all props from discriminated union', async () => {
      const entry = await extract(
        'Slider',
        dedent`
          import React from 'react';
          type ControlledProps = { value: number; defaultValue?: never };
          type UncontrolledProps = { value?: never; defaultValue?: number };
          type BaseProps = { min?: number; max?: number; step?: number };
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

    it('forces optional when union variant lacks a prop', async () => {
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

    it('merges same-named prop types across union members', async () => {
      const entry = await extract(
        'Component',
        dedent`
          import React from 'react';
          interface BaseProps { variant?: 'a' | 'b' }
          interface VariantAProps extends BaseProps {
            variant?: 'a';
            valueA?: string;
            valueB?: never;
          }
          interface VariantBProps extends BaseProps {
            variant: 'b';
            valueA?: never;
            valueB: string;
          }
          type Props = VariantAProps | VariantBProps;
          export const Component: React.FC<Props> = (props) => <div />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: {
          variant: {
            required: false,
            type: {
              name: 'enum',
              value: [{ value: '"a"' }, { value: '"b"' }],
            },
          },
        },
      });
    });
  });

  describe('utility types', () => {
    it('extracts Pick<>', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface FullProps { id: string; label: string; disabled: boolean; hidden: boolean }
          type ButtonProps = Pick<FullProps, 'id' | 'label'>;
          export const Button = (props: ButtonProps) => <button />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: { id: { type: { name: 'string' } }, label: { type: { name: 'string' } } },
      });
    });

    it('extracts Omit<>', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface FullProps { id: string; label: string; internal: boolean }
          type ButtonProps = Omit<FullProps, 'internal'>;
          export const Button = (props: ButtonProps) => <button />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: { id: { type: { name: 'string' } }, label: { type: { name: 'string' } } },
      });
    });

    it('extracts Partial<> as all optional', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface FullProps { label: string; count: number }
          export const Button = (props: Partial<FullProps>) => <button />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: { label: { required: false }, count: { required: false } },
      });
    });

    it('extracts Required<> as all required', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface OptionalProps { label?: string; count?: number }
          export const Button = (props: Required<OptionalProps>) => <button />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: { label: { required: true }, count: { required: true } },
      });
    });

    it('extracts Readonly<>', async () => {
      const entry = await extract(
        'Display',
        dedent`
          import React from 'react';
          interface Props { value: string; count: number }
          export const Display = (props: Readonly<Props>) => <div />;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: { value: { required: true }, count: { required: true } },
      });
    });

    it('extracts complex Pick & Omit & intersection', async () => {
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
        props: { a: {}, b: {}, c: {}, extra: {} },
      });
      expect(entry.component?.reactComponentMeta?.props).not.toHaveProperty('d');
    });

    it('extracts mapped type', async () => {
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
        props: { a: { type: { name: 'boolean' } }, b: { type: { name: 'boolean' } } },
      });
    });

    it('extracts conditional type', async () => {
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
        props: { check: { type: { name: 'true' } }, other: { type: { name: 'false' } } },
      });
    });

    it('extracts type alias wrapping interface', async () => {
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
        props: { label: { required: true }, count: { required: true } },
      });
    });
  });

  describe('forwardRef', () => {
    it('extracts props', async () => {
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
          variant: { type: { name: 'enum', value: [{ value: '"a"' }, { value: '"b"' }] } },
        },
      });
    });

    it('includes ref and key props', async () => {
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: {
          ref: { parent: { name: 'RefAttributes' } },
          key: { parent: { name: 'Attributes' } },
        },
      });
    });
  });

  describe('bulk source filtering', () => {
    it('filters HTML attributes exceeding >30 props threshold', async () => {
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
      expect(entry.component?.reactComponentMeta?.props).not.toHaveProperty('onClick');
      expect(entry.component?.reactComponentMeta?.props).not.toHaveProperty('className');
    });

    it('filters a prop another declaration file adds to React HTML attributes', async () => {
      // Next.js ships `@vercel/og` types that augment HTMLAttributes with a Tailwind `tw` prop.
      const entry = await extractFromStory(
        {
          'augmented/og.d.ts': dedent`
            import 'react';
            declare module 'react' {
              interface HTMLAttributes<T> {
                /** Specify styles using Tailwind CSS classes. */
                tw?: string;
              }
            }
          `,
          'augmented/Button.tsx': dedent`
            /// <reference path="./og.d.ts" />
            import React from 'react';
            interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
              label: string;
            }
            export const Button = (props: ButtonProps) => <button />;
          `,
          'augmented/Button.stories.tsx': dedent`
            import { Button } from './Button';
            export default { component: Button };
            export const Primary = {};
          `,
        },
        'augmented/Button.stories.tsx'
      );

      expect(Object.keys(entry.component?.reactComponentMeta?.props ?? {})).toEqual(['label']);
    });

    it('keeps HTML attributes when Pick narrows below threshold', async () => {
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        props: {
          disabled: { required: false },
          type: { required: false },
          label: { required: true },
        },
      });
    });
  });

  describe('without meta.component (JSX path)', () => {
    it('extracts props via named import', async () => {
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
          label: { description: 'The label', type: { name: 'string' }, required: true },
          variant: {
            type: { name: 'enum', value: [{ value: '"primary"' }, { value: '"secondary"' }] },
            required: false,
          },
        },
      });
    });

    it('extracts props via default import', async () => {
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
        props: { title: { required: true }, active: { required: false } },
      });
    });

    it('extracts props via { default as X } import', async () => {
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
        props: { title: { required: true }, open: { required: false } },
      });
    });

    it('extracts props via namespace import', async () => {
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
        props: { multiple: { required: false }, defaultValue: { type: { name: 'string' } } },
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
          label: { required: true },
          size: { type: { name: 'enum', value: [{ value: '"sm"' }, { value: '"md"' }] } },
        },
      });
    });
  });

  describe('JSDoc', () => {
    it('extracts prop-level descriptions', async () => {
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

    it('extracts component-level description', async () => {
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
  });
});

describe('PropTypes fallback for JS components', () => {
  it('reads PropTypes annotations the checker cannot resolve', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/PropTypesButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          export const Button = ({ label, primary = false, onClick, size, ...props }) => (
            <button onClick={onClick}>{label}</button>
          );

          Button.propTypes = {
            label: PropTypes.string.isRequired,
            primary: PropTypes.bool,
            size: PropTypes.oneOf(['small', 'medium', 'large']),
            onClick: PropTypes.func,
          };
        `,
        'test/PropTypesButton.stories.jsx': dedent`
          import { Button } from './PropTypesButton';

          export default { component: Button };
        `,
      },
      'test/PropTypesButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' }, required: true },
        primary: { type: { name: 'bool' }, required: false },
        size: {
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
          },
          required: false,
        },
        onClick: { type: { name: 'func' }, required: false },
      },
    });
  });

  it('accepts quoted keys, signed numbers, and boolean literals in oneOf', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/EdgeCaseButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          export const Button = ({ label, level, flag }) => <button />;

          Button.propTypes = {
            'label': PropTypes.string,
            level: PropTypes.oneOf([-1, 0, 1]),
            flag: PropTypes.oneOf([true, false]),
          };
        `,
        'test/EdgeCaseButton.stories.jsx': dedent`
          import { Button } from './EdgeCaseButton';

          export default { component: Button };
        `,
      },
      'test/EdgeCaseButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        label: { type: { name: 'string' } },
        level: {
          type: { name: 'enum', value: [{ value: '-1' }, { value: '0' }, { value: '1' }] },
        },
        flag: {
          type: { name: 'enum', value: [{ value: 'true' }, { value: 'false' }] },
        },
      },
    });
  });

  it('prefers propTypes for untyped JS props with destructuring defaults, like the sandbox template', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/DefaultSizeButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          export const Button = ({ primary = false, size = 'medium', label = 'Hello world' }) => (
            <button>{label}</button>
          );

          Button.propTypes = {
            primary: PropTypes.bool,
            size: PropTypes.oneOf(['small', 'medium', 'large']),
            label: PropTypes.string,
          };
        `,
        'test/DefaultSizeButton.stories.jsx': dedent`
          import { Button } from './DefaultSizeButton';

          export default { component: Button };
        `,
      },
      'test/DefaultSizeButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        // A destructuring default gives the checker a real type, but on an untyped JS binding the
        // propTypes annotation still wins — this is what restores the sandbox size control.
        primary: { type: { name: 'bool' }, required: false },
        size: {
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
          },
          required: false,
        },
        label: { type: { name: 'string' }, required: false },
      },
    });
  });

  it('keeps JSDoc types over propTypes on a typed .jsx component', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/JsDocButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';

          /**
           * @param {{ size?: 'small' | 'medium', label: string }} props
           */
          export const Button = (props) => <button />;

          Button.propTypes = {
            size: PropTypes.oneOf(['small', 'large']),
            label: PropTypes.string.isRequired,
          };
        `,
        'test/JsDocButton.stories.jsx': dedent`
          import { Button } from './JsDocButton';

          export default { component: Button };
        `,
      },
      'test/JsDocButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        // The JSDoc union wins over the oneOf enum — 'large' must not leak in.
        size: {
          required: false,
          type: {
            name: 'enum',
            value: [{ value: '"small"' }, { value: '"medium"' }],
          },
        },
        label: { type: { name: 'string' }, required: true },
      },
    });
  });

  it('keeps TS types over propTypes when a .jsx re-binds a .tsx component', async () => {
    const entry = await extractFromStoryWithConfig(
      {
        'test/InnerButton.tsx': dedent`
          import React from 'react';

          interface Props { label: string }

          export const InnerButton = (props: Props) => <button />;
        `,
        'test/ReboundButton.jsx': dedent`
          import React from 'react';
          import PropTypes from 'prop-types';
          import { InnerButton } from './InnerButton';

          export const Button = InnerButton;

          Button.propTypes = {
            label: PropTypes.oneOf(['a', 'b']),
          };
        `,
        'test/ReboundButton.stories.jsx': dedent`
          import { Button } from './ReboundButton';

          export default { component: Button };
        `,
      },
      'test/ReboundButton.stories.jsx',
      JS_TSCONFIG
    );

    expect(entry.component?.reactComponentMeta).toMatchObject({
      props: {
        // The prop declarations live in the .tsx file, so the TS type wins over the oneOf enum.
        label: { type: { name: 'string' }, required: true },
      },
    });
  });
});
