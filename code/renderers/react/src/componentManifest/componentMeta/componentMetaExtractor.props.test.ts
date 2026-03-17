import { describe, expect, it } from 'vitest';

import { extract } from './componentMetaExtractor.test-helpers';

describe('prop extraction', () => {
  it('extracts basic prop types', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface ButtonProps {
        label: string;
        count: number;
        disabled?: boolean;
      }
      export const Button = (props: ButtonProps) => <button />;
    `
    );

    expect(doc.props.label).toMatchObject({ type: { name: 'string' }, required: true });
    expect(doc.props.count).toMatchObject({ type: { name: 'number' }, required: true });
    expect(doc.props.disabled).toMatchObject({ required: false });
  });

  it('extracts string literal union as enum', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props {
        size: 'small' | 'medium' | 'large';
      }
      export const Button = (props: Props) => <button />;
    `
    );

    expect(doc.props.size.type).toMatchObject({
      name: 'enum',
      value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
    });
  });

  it('extracts optional string literal union as enum', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props {
        size?: 'small' | 'medium' | 'large';
      }
      export const Button = (props: Props) => <button />;
    `
    );

    expect(doc.props.size).toMatchObject({
      required: false,
      type: {
        name: 'enum',
        value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
      },
    });
  });

  it('extracts JSDoc descriptions', () => {
    const doc = extract(
      'Button',
      `
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

    expect(doc.props).toMatchObject({
      label: { description: 'The button label text' },
      primary: { description: 'Whether the button is in primary style' },
    });
  });

  it('extracts component-level JSDoc description', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props { label: string }
      /** Primary UI component for user interaction */
      export const Button = (props: Props) => <button />;
    `
    );

    expect(doc).toMatchObject({ description: 'Primary UI component for user interaction' });
  });

  it('extracts Pick<> props correctly', () => {
    const doc = extract(
      'Button',
      `
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

    expect(Object.keys(doc.props).sort()).toEqual(['id', 'label']);
  });

  it('extracts Omit<> props correctly', () => {
    const doc = extract(
      'Button',
      `
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

    expect(Object.keys(doc.props).sort()).toEqual(['id', 'label']);
  });

  it('extracts Partial<> props as all optional', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface FullProps {
        label: string;
        count: number;
      }
      export const Button = (props: Partial<FullProps>) => <button />;
    `
    );

    expect(doc.props).toMatchObject({
      label: { required: false },
      count: { required: false },
    });
  });

  it('extracts Required<> props as all required', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface OptionalProps {
        label?: string;
        count?: number;
      }
      export const Button = (props: Required<OptionalProps>) => <button />;
    `
    );

    expect(doc.props).toMatchObject({
      label: { required: true },
      count: { required: true },
    });
  });

  it('extracts extends interface props', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface BaseProps { id: string }
      interface ButtonProps extends BaseProps {
        label: string;
        variant?: 'primary' | 'secondary';
      }
      export const Button = (props: ButtonProps) => <button />;
    `
    );

    expect(doc.props).toMatchObject({
      id: { parent: { name: 'BaseProps' } },
      label: { parent: { name: 'ButtonProps' } },
      variant: { parent: { name: 'ButtonProps' } },
    });
  });

  it('extracts generic component props', () => {
    const doc = extract(
      'StringList',
      `
      import React from 'react';
      interface ListProps<T> {
        items: T[];
        renderItem: (item: T) => React.ReactNode;
      }
      export const StringList = (props: ListProps<string>) => <ul />;
    `
    );

    expect(doc.props).toMatchObject({
      items: { type: { name: 'string[]' } },
      renderItem: { type: { name: '(item: string) => ReactNode' } },
    });
  });

  it('flattens intersection types to all member props', () => {
    const doc = extract(
      'Comp',
      `
      import React from 'react';
      interface A { x: string }
      interface B { y: number }
      export const Comp = (props: A & B) => <div />;
    `
    );

    expect(Object.keys(doc.props).sort()).toEqual(['x', 'y']);
    expect(doc.props).toMatchObject({
      x: { type: { name: 'string' } },
      y: { type: { name: 'number' } },
    });
  });

  it('flattens complex Pick & Omit combinations', () => {
    const doc = extract(
      'Comp',
      `
      import React from 'react';
      interface Full { a: string; b: number; c: boolean; d: string }
      type Props = Pick<Full, 'a' | 'b' | 'c'> & Omit<{ extra: string; d: number }, 'd'>;
      export const Comp = (props: Props) => <div />;
    `
    );

    expect(Object.keys(doc.props).sort()).toEqual(['a', 'b', 'c', 'extra']);
    expect(doc.props).not.toHaveProperty('d');
  });

  it('resolves generic instantiations to concrete prop types', () => {
    const doc = extract(
      'NumberList',
      `
      import React from 'react';
      interface ListProps<T> {
        items: T[];
        selected?: T;
      }
      export const NumberList = (props: ListProps<number>) => <ul />;
    `
    );

    expect(doc.props).toMatchObject({
      items: { type: { name: 'number[]' } },
      selected: { type: { name: 'number' } },
    });
  });

  it('extracts number literal union as enum', () => {
    const doc = extract(
      'Grid',
      `
      import React from 'react';
      interface Props { columns: 1 | 2 | 3 | 4 }
      export const Grid = (props: Props) => <div />;
    `
    );

    expect(doc.props.columns.type).toMatchObject({
      name: 'enum',
      value: [{ value: '1' }, { value: '2' }, { value: '3' }, { value: '4' }],
    });
  });

  it('extracts mixed union (string | number) as type string, not enum', () => {
    const doc = extract(
      'Input',
      `
      import React from 'react';
      interface Props { value: string | number }
      export const Input = (props: Props) => <input />;
    `
    );

    expect(doc.props.value.type.name).toBe('string | number');
  });

  it('preserves nested | undefined in optional props with generic types', () => {
    const doc = extract(
      'Widget',
      `
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

    expect(doc.props).toMatchObject({
      config: { type: { name: 'Record<string, number | undefined>' } },
      onChange: { type: { name: '(value: string | undefined) => void' } },
      label: { type: { name: 'string' } },
      handler: { type: { name: 'string | ((x: number) => void) | undefined' } },
      combo: { type: { name: 'string | (A & B) | undefined' } },
      boolOrStr: { type: { name: 'string | boolean | undefined' } },
    });
  });

  it('extracts function prop types', () => {
    const doc = extract(
      'Form',
      `
      import React from 'react';
      interface Props {
        onClick: () => void;
        onChange: (value: string) => void;
        onSubmit: (event: React.FormEvent) => Promise<void>;
      }
      export const Form = (props: Props) => <form />;
    `
    );

    expect(doc.props).toMatchObject({
      onClick: { type: { name: '() => void' } },
      onChange: { type: { name: '(value: string) => void' } },
      onSubmit: { type: { name: '(event: FormEvent<Element>) => Promise<void>' } },
    });
  });

  it('extracts complex nested object props', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Theme {
        colors: { primary: string; secondary: string };
        spacing: number;
      }
      interface Props { theme: Theme; label: string }
      export const Button = (props: Props) => <button />;
    `
    );

    expect(doc.props).toMatchObject({
      theme: { type: { name: 'Theme' } },
      label: { type: { name: 'string' } },
    });
  });

  it('extracts React.ReactNode and React.ReactElement prop types', () => {
    const doc = extract(
      'Card',
      `
      import React from 'react';
      interface Props {
        children: React.ReactNode;
        icon: React.ReactElement;
        header?: React.ReactNode;
      }
      export const Card = (props: Props) => <div />;
    `
    );

    expect(doc.props).toMatchObject({
      children: { type: { name: 'ReactNode' } },
      icon: { type: { name: 'ReactElement<any, string | JSXElementConstructor<any>>' } },
      header: { type: { name: 'ReactNode' } },
    });
  });

  it('filters out HTML attributes from extends (ButtonHTMLAttributes has >30 props)', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
        variant: 'primary' | 'secondary';
        label: string;
      }
      export const Button = (props: ButtonProps) => <button />;
    `
    );

    const propNames = Object.keys(doc.props);
    expect(propNames).toContain('variant');
    expect(propNames).toContain('label');
    // HTML attributes from ButtonHTMLAttributes should be filtered out (>30 props threshold)
    expect(propNames).not.toContain('onClick');
    expect(propNames).not.toContain('className');
  });

  it('keeps HTML attributes from extends when Pick narrows to few props', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      type ButtonProps = Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'type'> & {
        label: string;
      };
      export const Button = (props: ButtonProps) => <button />;
    `
    );

    // Under the threshold, HTML attrs are kept
    expect(doc.props).toHaveProperty('disabled');
    expect(doc.props).toHaveProperty('type');
    expect(doc.props).toHaveProperty('label');
  });

  it('extracts forwardRef component props', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props { label: string; variant?: 'a' | 'b' }
      export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
        <button ref={ref} />
      ));
    `
    );

    expect(doc.props.label).toMatchObject({ type: { name: 'string' }, required: true });
    expect(doc.props.variant.type).toMatchObject({
      name: 'enum',
      value: [{ value: '"a"' }, { value: '"b"' }],
    });
  });

  it('includes ref and key props for forwardRef components', () => {
    const doc = extract(
      'Button',
      `
      import React from 'react';
      interface Props { label: string }
      export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
        <button ref={ref} />
      ));
    `
    );

    // ref and key come from React internals, not from the user's Props interface
    expect(doc.props).toMatchObject({
      ref: { parent: { name: 'RefAttributes' } },
      key: { parent: { name: 'Attributes' } },
    });
  });

  it('collects all props from discriminated union', () => {
    const doc = extract(
      'Slider',
      `
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

    expect(Object.keys(doc.props).sort()).toEqual(['defaultValue', 'max', 'min', 'step', 'value']);
  });
});
