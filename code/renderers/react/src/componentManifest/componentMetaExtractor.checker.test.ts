/**
 * PropExtractor tests using the LanguageService (checker) approach.
 *
 * These are copies of the tests in componentMetaExtractor.test.ts, rewritten to use
 * ComponentMetaProject (persistent LanguageService) instead of createVirtualProgram (one-shot
 * ts.Program per test). This makes the entire suite much faster since the LS is created once and
 * incrementally reused.
 *
 * The original tests in componentMetaExtractor.test.ts are kept for reference.
 */
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import ts from 'typescript';

import { ComponentMetaProject } from './checker/ComponentMetaProject';
import type { ComponentDoc } from './componentMetaExtractor';

// ---------------------------------------------------------------------------
// Shared infrastructure — one ComponentMetaProject for all tests
// ---------------------------------------------------------------------------

/**
 * Use ts.sys for all file I/O. The react vitest setup mocks node:fs with memfs, but ts.sys uses the
 * real filesystem (it imported fs before mocks were applied).
 */
const sys = ts.sys;

/** Path to the monorepo root where node_modules with @types/react lives */
const MONOREPO_ROOT = path.resolve(__dirname, '../../../../..');

/**
 * All test source files, keyed by relative path within the temp project. Written to disk in
 * beforeAll, included in a single tsconfig.
 */
const TEST_FILES: Record<string, string> = {
  // =========================================================================
  // component detection — function components
  // =========================================================================
  'detect/arrow.tsx': `
    import React from 'react';
    interface Props { label: string }
    export const Button = (props: Props) => <button>{props.label}</button>;
  `,
  'detect/function.tsx': `
    import React from 'react';
    export function Button(props: { label: string }) { return <button /> }
  `,
  'detect/null_return.tsx': `
    import React from 'react';
    export const Empty = (props: { show: boolean }) => props.show ? <div /> : null;
  `,
  'detect/no_props.tsx': `
    import React from 'react';
    export const Logo = () => <svg />;
  `,

  // =========================================================================
  // component detection — class components
  // =========================================================================
  'detect/class_component.tsx': `
    import React from 'react';
    export class Button extends React.Component<{ label: string }> {
      render() { return <button /> }
    }
  `,
  'detect/class_pure.tsx': `
    import React from 'react';
    export class Button extends React.PureComponent<{ label: string }> {
      render() { return <button /> }
    }
  `,

  // =========================================================================
  // component detection — wrapped components
  // =========================================================================
  'detect/memo.tsx': `
    import React from 'react';
    const Inner = (props: { label: string }) => <button />;
    export const Button = React.memo(Inner);
  `,
  'detect/forwardref.tsx': `
    import React from 'react';
    export const Button = React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => (
      <button ref={ref} />
    ));
  `,
  'detect/memo_forwardref.tsx': `
    import React from 'react';
    export const Button = React.memo(
      React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => <button ref={ref} />)
    );
  `,
  'detect/lazy/Target.tsx': `
    import React from 'react';
    export default (props: {}) => <button />;
  `,
  'detect/lazy/Lazy.tsx': `
    import React from 'react';
    export const LazyButton = React.lazy(() => import('./Target'));
  `,

  // =========================================================================
  // component detection — default exports
  // =========================================================================
  'detect/default.tsx': `
    import React from 'react';
    const Button = (props: { label: string }) => <button />;
    export default Button;
  `,
  'detect/default_inline.tsx': `
    import React from 'react';
    export default (props: { label: string }) => <button />;
  `,
  'detect/default_function.tsx': `
    import React from 'react';
    export default function Button(props: { label: string }) { return <button /> }
  `,

  // =========================================================================
  // component detection — non-components
  // =========================================================================
  'detect/plain_object.ts': `
    export const Config = { key: 'value' };
  `,
  'detect/lowercase.tsx': `
    import React from 'react';
    export const button = (props: { label: string }) => <button />;
  `,
  'detect/string_const.ts': `
    export const Title = 'Hello';
  `,
  'detect/number_const.ts': `
    export const Count = 42;
  `,
  'detect/array_const.ts': `
    export const Items = [1, 2, 3];
  `,
  'detect/type_only.ts': `
    export interface ButtonProps { label: string }
    export type Size = 'small' | 'large';
  `,
  'detect/class_non_component.ts': `
    export class Store {
      data = {};
      get(key: string) { return this.data; }
    }
  `,

  // =========================================================================
  // component detection — RDT false positives
  // =========================================================================
  'detect/fp_lowercase.ts': `
    export function add(a: number) { return a + 1; }
  `,
  'detect/fp_formatdate.ts': `
    export function FormatDate(timestamp: number) { return new Date(timestamp).toISOString(); }
  `,
  'detect/fp_parseprops.ts': `
    export function ParseProps(props: string) { return JSON.parse(props); }
  `,
  'detect/fp_usecounter.ts': `
    export function UseCounter(initial: number) {
      return { count: initial, increment: () => {} };
    }
  `,
  'detect/fp_createvalidator.ts': `
    export function CreateValidator(schema: object) {
      return (data: unknown) => ({ valid: true, errors: [] });
    }
  `,
  'detect/fp_buttonvariant.ts': `
    export const ButtonVariant = {
      Primary: 'primary',
      Secondary: 'secondary',
    } as const;
  `,

  // =========================================================================
  // component detection — mixed exports
  // =========================================================================
  'detect/mixed.tsx': `
    import React from 'react';
    export const Button = (props: { label: string }) => <button />;
    export const Config = { key: 'value' };
    export const Icon = (props: { name: string }) => <span />;
    export const SIZES = ['small', 'large'] as const;
  `,
  'detect/mixed_types.tsx': `
    import React from 'react';
    export interface ButtonProps { label: string }
    export const Button = (props: ButtonProps) => <button />;
    export type Size = 'small' | 'large';
  `,

  // =========================================================================
  // componentMetaExtractor — component detection
  // =========================================================================
  'extract/arrow.tsx': `
    import React from 'react';
    interface Props { label: string }
    export const Button = (props: Props) => <button>{props.label}</button>;
  `,
  'extract/function.tsx': `
    import React from 'react';
    interface Props { label: string }
    export function Button(props: Props) { return <button>{props.label}</button> }
  `,
  'extract/default.tsx': `
    import React from 'react';
    interface Props { label: string }
    const Button = (props: Props) => <button>{props.label}</button>;
    export default Button;
  `,
  'extract/skip_lowercase.ts': `
    export const helper = (x: number) => x + 1;
  `,
  'extract/skip_config.ts': `
    export const Config = { key: 'value' };
  `,
  'extract/multi.tsx': `
    import React from 'react';
    interface ButtonProps { label: string }
    interface IconProps { name: string }
    export const Button = (props: ButtonProps) => <button>{props.label}</button>;
    export const Icon = (props: IconProps) => <span>{props.name}</span>;
  `,

  // =========================================================================
  // componentMetaExtractor — props extraction
  // =========================================================================
  'extract/basic_types.tsx': `
    import React from 'react';
    interface ButtonProps {
      label: string;
      count: number;
      disabled?: boolean;
    }
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/string_enum.tsx': `
    import React from 'react';
    interface Props {
      size: 'small' | 'medium' | 'large';
    }
    export const Button = (props: Props) => <button />;
  `,
  'extract/optional_enum.tsx': `
    import React from 'react';
    interface Props {
      size?: 'small' | 'medium' | 'large';
    }
    export const Button = (props: Props) => <button />;
  `,
  'extract/jsdoc.tsx': `
    import React from 'react';
    interface Props {
      /** The button label text */
      label: string;
      /** Whether the button is in primary style */
      primary?: boolean;
    }
    export const Button = (props: Props) => <button />;
  `,
  'extract/component_jsdoc.tsx': `
    import React from 'react';
    interface Props { label: string }
    /** Primary UI component for user interaction */
    export const Button = (props: Props) => <button />;
  `,

  // =========================================================================
  // componentMetaExtractor — parent/source info
  // =========================================================================
  'extract/parent_named.tsx': `
    import React from 'react';
    interface ButtonProps {
      label: string;
    }
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/parent_inline.tsx': `
    import React from 'react';
    export const Button = (props: { label: string }) => <button />;
  `,
  'extract/parent_typeliteral_intersection.tsx': `
    import React from 'react';
    type BaseProps = { loading?: boolean };
    type ButtonProps = { variant?: string } & BaseProps;
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/parent_polymorphic_cast.tsx': `
    import React from 'react';
    type BaseProps = { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>;
    type ButtonProps = { variant?: string } & BaseProps;
    type PolymorphicFC<As extends React.ElementType, P> =
      React.ForwardRefExoticComponent<P & { as?: As } & React.RefAttributes<any>>;
    export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
      (props, ref) => <button ref={ref} />
    ) as PolymorphicFC<'button', ButtonProps>;
  `,

  // =========================================================================
  // componentMetaExtractor — display name
  // =========================================================================
  'extract/dn_named.tsx': `
    import React from 'react';
    interface Props { label: string }
    export const MyButton = (props: Props) => <button />;
  `,
  'extract/dn_default.tsx': `
    import React from 'react';
    interface Props { label: string }
    const MyButton = (props: Props) => <button />;
    export default MyButton;
  `,
  'extract/dn/Widget.tsx': `
    import React from 'react';
    export default (props: { label: string }) => <button />;
  `,
  'extract/dn/TextInput/TextInput.tsx': `
    import React from 'react';
    export default (props: { value: string }) => <input />;
  `,
  'extract/dn/TextInput/index.ts': `
    export { default } from './TextInput';
  `,

  // =========================================================================
  // componentMetaExtractor — defaultValue
  // =========================================================================
  'extract/dv_destructuring.tsx': `
    import React from 'react';
    interface Props { size?: string; color?: string; label: string }
    export const Button = ({ size = 'md', color = 'blue', label }: Props) => <button />;
  `,
  'extract/dv_forwardref.tsx': `
    import React from 'react';
    interface Props { variant?: string; label: string }
    export const Button = React.forwardRef<HTMLButtonElement, Props>(
      ({ variant = 'primary', label }, ref) => <button ref={ref} />
    );
  `,
  'extract/dv_jsdoc.tsx': `
    import React from 'react';
    interface Props {
      /** @default 'md' */
      size?: string;
      label: string;
    }
    export const Button = (props: Props) => <button />;
  `,
  'extract/dv_body_destructuring.tsx': `
    import React from 'react';
    interface Props { color?: string; rounded?: boolean; label: string }
    export const Alert = React.forwardRef<HTMLDivElement, Props>((props, ref) => {
      const { color = 'info', rounded = true, label } = props;
      return <div ref={ref} />;
    });
  `,
  'extract/dv_identifier_resolution.tsx': `
    import React from 'react';
    const DEFAULT_SIZE = 'md';
    const DEFAULT_COUNT = 42;
    interface Props { size?: string; count?: number; label: string }
    export const Button = ({ size = DEFAULT_SIZE, count = DEFAULT_COUNT, label }: Props) => <button />;
  `,
  'extract/dv_defaultprops.tsx': `
    import React from 'react';
    interface Props { size?: string; color?: string; label: string }
    export const Button = (props: Props) => <button />;
    Button.defaultProps = { size: 'md', color: 'blue' };
  `,
  'extract/dv_static_defaultprops.tsx': `
    import React from 'react';
    interface Props { size?: string; label: string }
    export class Button extends React.Component<Props> {
      static defaultProps = { size: 'md' };
      render() { return <button />; }
    }
  `,

  // =========================================================================
  // componentMetaExtractor — fixture: Button
  // =========================================================================
  'extract/fixture_button.tsx': `
    import React from 'react';
    export interface ButtonProps {
      /** Description of primary */
      primary?: boolean;
      backgroundColor?: string;
      size?: 'small' | 'medium' | 'large';
      label: string;
      onClick?: () => void;
    }

    /**
     * Primary UI component for user interaction
     * @import import { Button } from '@design-system/components/override';
     */
    export const Button = ({
      primary = false,
      size = 'medium',
      backgroundColor,
      label,
      ...props
    }: ButtonProps) => {
      const mode = primary ? 'storybook-button--primary' : 'storybook-button--secondary';
      return (
        <button
          type="button"
          className={['storybook-button', \`storybook-button--\${size}\`, mode].join(' ')}
          style={{ backgroundColor }}
          {...props}
        >
          {label}
        </button>
      );
    };
  `,

  // =========================================================================
  // componentMetaExtractor — fixture: Header (default export)
  // =========================================================================
  'extract/fixture/Header.tsx': `
    import React from 'react';

    interface User {
      name: string;
    }

    export interface HeaderProps {
      user?: User;
      onLogin?: () => void;
      onLogout?: () => void;
      onCreateAccount?: () => void;
    }

    export default ({ user, onLogin, onLogout, onCreateAccount }: HeaderProps) => (
      <header>
        <div>{user?.name}</div>
      </header>
    );
  `,

  // =========================================================================
  // componentMetaExtractor — class components
  // =========================================================================
  'extract/class.tsx': `
    import React from 'react';
    interface Props { label: string }
    export class Button extends React.Component<Props> {
      render() { return <button>{this.props.label}</button> }
    }
  `,

  // =========================================================================
  // componentMetaExtractor — memo and forwardRef
  // =========================================================================
  'extract/memo.tsx': `
    import React from 'react';
    interface Props { label: string }
    const Inner = (props: Props) => <button />;
    export const Button = React.memo(Inner);
  `,
  'extract/forwardref.tsx': `
    import React from 'react';
    interface Props { label: string }
    export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
      <button ref={ref}>{props.label}</button>
    ));
  `,

  // =========================================================================
  // componentMetaExtractor — intersection types
  // =========================================================================
  'extract/intersection.tsx': `
    import React from 'react';
    interface BaseProps { id: string }
    interface StyleProps { className?: string }
    type ButtonProps = BaseProps & StyleProps & { label: string };
    export const Button = (props: ButtonProps) => <button />;
  `,

  // =========================================================================
  // componentMetaExtractor — edge cases
  // =========================================================================
  'extract/pick.tsx': `
    import React from 'react';
    interface FullProps {
      id: string;
      label: string;
      disabled: boolean;
      hidden: boolean;
    }
    type ButtonProps = Pick<FullProps, 'id' | 'label'>;
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/omit.tsx': `
    import React from 'react';
    interface FullProps {
      id: string;
      label: string;
      internal: boolean;
    }
    type ButtonProps = Omit<FullProps, 'internal'>;
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/partial.tsx': `
    import React from 'react';
    interface FullProps {
      label: string;
      count: number;
    }
    export const Button = (props: Partial<FullProps>) => <button />;
  `,
  'extract/required.tsx': `
    import React from 'react';
    interface OptionalProps {
      label?: string;
      count?: number;
    }
    export const Button = (props: Required<OptionalProps>) => <button />;
  `,
  'extract/extends.tsx': `
    import React from 'react';
    interface BaseProps { id: string }
    interface ButtonProps extends BaseProps {
      label: string;
      variant?: 'primary' | 'secondary';
    }
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/generic.tsx': `
    import React from 'react';
    interface ListProps<T> {
      items: T[];
      renderItem: (item: T) => React.ReactNode;
    }
    export const StringList = (props: ListProps<string>) => <ul />;
  `,
  'extract/number_enum.tsx': `
    import React from 'react';
    interface Props { columns: 1 | 2 | 3 | 4 }
    export const Grid = (props: Props) => <div />;
  `,
  'extract/mixed_union.tsx': `
    import React from 'react';
    interface Props { value: string | number }
    export const Input = (props: Props) => <input />;
  `,
  'extract/function_props.tsx': `
    import React from 'react';
    interface Props {
      onClick: () => void;
      onChange: (value: string) => void;
      onSubmit: (event: React.FormEvent) => Promise<void>;
    }
    export const Form = (props: Props) => <form />;
  `,
  'extract/nested_object.tsx': `
    import React from 'react';
    interface Theme {
      colors: { primary: string; secondary: string };
      spacing: number;
    }
    interface Props { theme: Theme; label: string }
    export const Button = (props: Props) => <button />;
  `,
  'extract/reactnode.tsx': `
    import React from 'react';
    interface Props {
      children: React.ReactNode;
      icon: React.ReactElement;
      header?: React.ReactNode;
    }
    export const Card = (props: Props) => <div />;
  `,
  'extract/html_extends.tsx': `
    import React from 'react';
    interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
      variant: 'primary' | 'secondary';
      label: string;
    }
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/small_html.tsx': `
    import React from 'react';
    type ButtonProps = Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'type'> & {
      label: string;
    };
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/forwardref_props.tsx': `
    import React from 'react';
    interface Props { label: string; variant?: 'a' | 'b' }
    export const Button = React.forwardRef<HTMLButtonElement, Props>((props, ref) => (
      <button ref={ref} />
    ));
  `,

  // =========================================================================
  // componentMetaExtractor — source/parent tracking
  // =========================================================================
  'extract/parent_intersection.tsx': `
    import React from 'react';
    interface BaseProps {
      /** Unique identifier */
      id: string;
    }
    interface StyleProps {
      /** Custom CSS class */
      className?: string;
    }
    type ButtonProps = BaseProps & StyleProps & {
      /** The label */
      label: string;
    };
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/parent_extends.tsx': `
    import React from 'react';
    interface BaseProps {
      /** Unique identifier */
      id: string;
    }
    interface ButtonProps extends BaseProps {
      label: string;
    }
    export const Button = (props: ButtonProps) => <button />;
  `,
  'extract/parent_multi_decl.tsx': `
    import React from 'react';
    interface A { shared: string }
    interface B { shared: string }
    type Props = A & B;
    export const Comp = (props: Props) => <div />;
  `,
  'extract/parent_filter.tsx': `
    import React from 'react';
    interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
      /** Custom variant */
      variant: 'primary' | 'secondary';
    }
    export const Button = (props: ButtonProps) => <button />;
  `,

  // =========================================================================
  // componentMetaExtractor — type flattening
  // =========================================================================
  'extract/flat_pick.tsx': `
    import React from 'react';
    interface Full { a: string; b: number; c: boolean }
    export const Comp = (props: Pick<Full, 'a' | 'b'>) => <div />;
  `,
  'extract/flat_omit.tsx': `
    import React from 'react';
    interface Full { a: string; b: number; c: boolean }
    export const Comp = (props: Omit<Full, 'c'>) => <div />;
  `,
  'extract/flat_intersection.tsx': `
    import React from 'react';
    interface A { x: string }
    interface B { y: number }
    export const Comp = (props: A & B) => <div />;
  `,
  'extract/flat_complex.tsx': `
    import React from 'react';
    interface Full { a: string; b: number; c: boolean; d: string }
    type Props = Pick<Full, 'a' | 'b' | 'c'> & Omit<{ extra: string; d: number }, 'd'>;
    export const Comp = (props: Props) => <div />;
  `,
  'extract/flat_generic.tsx': `
    import React from 'react';
    interface ListProps<T> {
      items: T[];
      selected?: T;
    }
    export const NumberList = (props: ListProps<number>) => <ul />;
  `,
  'extract/discriminated_union.tsx': `
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
  `,

  // =========================================================================
  // QA: Park UI — ForwardRefExoticComponent from HOC factory
  // =========================================================================
  'qa/park_provider.tsx': `
    import React from 'react';

    function withProvider<T extends HTMLElement, P>(
      Component: React.ComponentType<any>,
      _slot: string
    ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
      return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
    }

    interface RootProps {
      /** The accordion items */
      items: string[];
      /** Whether multiple items can be open */
      multiple?: boolean;
    }

    const InternalRoot = (props: RootProps) => <div />;

    export const Root = withProvider<HTMLDivElement, RootProps>(InternalRoot, 'root');
  `,
  'qa/park_context.tsx': `
    import React from 'react';

    function withContext<T extends HTMLElement, P>(
      Component: React.ComponentType<any>,
      _slot: string
    ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
      return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
    }

    interface ItemTriggerProps {
      /** Click handler */
      onClick?: () => void;
    }

    const BaseItemTrigger = (props: ItemTriggerProps) => <button />;

    export const ItemTrigger = withContext<HTMLButtonElement, ItemTriggerProps>(
      BaseItemTrigger, 'itemTrigger'
    );
  `,
  'qa/park_accordion.tsx': `
    import React from 'react';

    function withProvider<T extends HTMLElement, P>(
      Component: React.ComponentType<any>,
      _slot: string
    ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
      return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
    }

    function withContext<T extends HTMLElement, P>(
      Component: React.ComponentType<any>,
      _slot: string
    ): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<T>> {
      return React.forwardRef<T, P>((props, ref) => <Component {...props} ref={ref} />) as any;
    }

    interface RootProps { multiple?: boolean }
    interface ItemProps { value: string; disabled?: boolean }
    interface ItemTriggerProps { onClick?: () => void }

    const InternalRoot = (props: RootProps) => <div />;
    const InternalItem = (props: ItemProps) => <div />;
    const InternalTrigger = (props: ItemTriggerProps) => <button />;

    export const Root = withProvider<HTMLDivElement, RootProps>(InternalRoot, 'root');
    export const Item = withContext<HTMLDivElement, ItemProps>(InternalItem, 'item');
    export const ItemTrigger = withContext<HTMLButtonElement, ItemTriggerProps>(
      InternalTrigger, 'itemTrigger'
    );
  `,

  // =========================================================================
  // QA: Primer — as-cast with marker intersection
  // =========================================================================
  'qa/primer_slot_marker.tsx': `
    import React from 'react';

    interface CheckboxProps {
      /** Whether the checkbox is checked */
      checked?: boolean;
      /** Change handler */
      onChange?: (checked: boolean) => void;
      /** Disabled state */
      disabled?: boolean;
    }

    interface SlotMarker { __SLOT__?: symbol }
    type WithSlotMarker<T> = T & SlotMarker;

    const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>((props, ref) => (
      <input type="checkbox" ref={ref} />
    ));

    (Checkbox as WithSlotMarker<typeof Checkbox>).__SLOT__ = Symbol('Checkbox');

    export default Checkbox as WithSlotMarker<typeof Checkbox>;
  `,

  // =========================================================================
  // QA: Primer — PolymorphicForwardRefComponent
  // =========================================================================
  'qa/primer_polymorphic.tsx': `
    import React from 'react';

    type Merge<A, B> = Omit<A, keyof B> & B;

    interface PolymorphicForwardRefComponent<
      DefaultElement extends React.ElementType,
      OwnProps = {}
    > extends React.ForwardRefExoticComponent<
      Merge<React.ComponentPropsWithRef<DefaultElement>, OwnProps & { as?: DefaultElement }>
    > {
      <As extends React.ElementType = DefaultElement>(
        props: Merge<React.ComponentPropsWithRef<As>, OwnProps & { as?: As }>
      ): React.ReactElement | null;
    }

    interface ButtonProps {
      /** Button variant style */
      variant?: 'default' | 'primary' | 'danger';
      /** Button size */
      size?: 'small' | 'medium' | 'large';
    }

    const ButtonComponent = React.forwardRef<HTMLButtonElement, ButtonProps>(
      (props, ref) => <button ref={ref} />
    ) as PolymorphicForwardRefComponent<'button', ButtonProps>;

    ButtonComponent.displayName = 'Button';

    export { ButtonComponent as Button };
  `,

  // =========================================================================
  // QA: Primer — PolymorphicForwardRefComponent with destructuring defaults
  // =========================================================================
  'qa/primer_polymorphic_defaults.tsx': `
    import React, { forwardRef, type ElementType } from 'react';

    type Merge<A, B> = Omit<A, keyof B> & B;

    interface PolymorphicForwardRefComponent<
      DefaultElement extends React.ElementType,
      OwnProps = {}
    > extends React.ForwardRefExoticComponent<
      Merge<React.ComponentPropsWithRef<DefaultElement>, OwnProps & { as?: DefaultElement }>
    > {
      <As extends React.ElementType = DefaultElement>(
        props: Merge<React.ComponentPropsWithRef<As>, OwnProps & { as?: As }>
      ): React.ReactElement | null;
    }

    interface StackProps {
      /** Specify the direction
       * @default vertical
       */
      direction?: 'horizontal' | 'vertical';
      /** Specify the alignment */
      align?: 'stretch' | 'start' | 'center' | 'end';
      /** Specify wrapping */
      wrap?: 'wrap' | 'nowrap';
    }

    const Stack = forwardRef(
      ({
        direction = 'vertical',
        align = 'stretch',
        wrap = 'nowrap',
        ...rest
      }: StackProps, forwardedRef: React.Ref<HTMLDivElement>) => {
        return <div ref={forwardedRef} {...rest} />;
      },
    ) as PolymorphicForwardRefComponent<ElementType, StackProps>;

    export { Stack };
  `,

  // =========================================================================
  // QA: Primer — Object.assign compound component
  // =========================================================================
  'qa/primer_object_assign.tsx': `
    import React from 'react';

    interface FormControlProps {
      /** Unique identifier */
      id: string;
      /** Whether the field is required */
      required?: boolean;
      /** Whether the field is disabled */
      disabled?: boolean;
    }

    const FormControlBase = React.forwardRef<HTMLDivElement, FormControlProps>(
      (props, ref) => <div ref={ref} />
    );

    const Caption = (props: { children: React.ReactNode }) => <span />;
    const Label = (props: { children: React.ReactNode }) => <label />;

    const FormControl = Object.assign(FormControlBase, {
      Caption,
      Label,
    });

    export default FormControl;
  `,

  // =========================================================================
  // QA: Primer — Object.assign compound + destructuring defaults (Stack)
  // =========================================================================
  'qa/primer_stack/Stack.tsx': `
    import React, { forwardRef, type ElementType } from 'react';

    interface StackProps {
      /** Specify the direction
       * @default vertical
       */
      direction?: 'horizontal' | 'vertical';
      /** Specify the alignment */
      align?: 'stretch' | 'start' | 'center' | 'end';
      /** Specify wrapping */
      wrap?: 'wrap' | 'nowrap';
    }

    const StackImpl = forwardRef(
      ({
        direction = 'vertical',
        align = 'stretch',
        wrap = 'nowrap',
        ...rest
      }: StackProps, forwardedRef: React.Ref<HTMLDivElement>) => {
        return <div ref={forwardedRef} {...rest} />;
      },
    );

    const StackItem = (props: { children: React.ReactNode }) => <div />;

    export const Stack = Object.assign(StackImpl, { Item: StackItem });
  `,

  // =========================================================================
  // QA: Primer — aliased barrel re-export
  // =========================================================================
  'qa/barrel/Button.tsx': `
    import React from 'react';
    interface ButtonProps {
      /** Button label */
      label: string;
      /** Visual variant */
      variant?: 'solid' | 'outline' | 'ghost';
    }
    export const InternalButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
      (props, ref) => <button ref={ref}>{props.label}</button>
    );
    InternalButton.displayName = 'Button';
  `,
  'qa/barrel/index.ts': `export { InternalButton as Button } from './Button';`,

  // =========================================================================
  // QA: Mantine — empty interface with deep extends
  // =========================================================================
  'qa/mantine_textinput.tsx': `
    import React from 'react';

    interface StylesApiProps {
      /** CSS class name */
      className?: string;
      /** Inline styles */
      style?: React.CSSProperties;
    }

    interface BaseInputProps {
      /** Input label */
      label?: React.ReactNode;
      /** Error message */
      error?: React.ReactNode;
      /** Description text */
      description?: React.ReactNode;
    }

    interface BoxProps {
      /** Custom component */
      component?: React.ElementType;
    }

    type ElementProps<E extends React.ElementType, Excluded extends string = never> =
      Omit<React.ComponentPropsWithoutRef<E>, Excluded>;

    interface TextInputProps extends BoxProps, BaseInputProps,
      StylesApiProps, ElementProps<'input', 'size'> {}

    export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
      (props, ref) => <input ref={ref} />
    );
  `,

  // =========================================================================
  // QA: Mantine — factory() wrapping forwardRef internally
  // =========================================================================
  'qa/mantine_factory.tsx': `
    import React from 'react';

    interface FactoryPayload {
      props: Record<string, any>;
      ref: HTMLElement;
    }

    type MantineComponent<Payload extends FactoryPayload> =
      React.ForwardRefExoticComponent<
        Payload['props'] & React.RefAttributes<Payload['ref']>
      >;

    function factory<Payload extends FactoryPayload>(
      renderFn: (props: Payload['props'], ref: React.Ref<Payload['ref']>) => React.ReactNode
    ): MantineComponent<Payload> {
      const Component = React.forwardRef(renderFn as any) as any;
      return Component;
    }

    interface SelectProps {
      /** Currently selected value */
      value?: string;
      /** Change handler */
      onChange?: (value: string | null) => void;
      /** Dropdown options */
      data: string[];
      /** Whether the select is searchable */
      searchable?: boolean;
    }

    interface SelectFactory extends FactoryPayload {
      props: SelectProps;
      ref: HTMLInputElement;
    }

    export const Select = factory<SelectFactory>((_props, ref) => {
      return <input ref={ref} />;
    });
  `,

  // =========================================================================
  // QA: false positive rejection
  // =========================================================================
  'qa/fp_utility.ts': `
    export function CreateTheme(options: { primary: string; secondary: string }) {
      return { colors: options };
    }
  `,
  'qa/fp_hof.ts': `
    export function CreateValidator(config: { strict: boolean }) {
      return (value: string) => config.strict ? value.trim() : value;
    }
  `,
  'qa/fp_class.ts': `
    export class EventEmitter {
      private listeners = new Map<string, Function[]>();
      on(event: string, fn: Function) { /* ... */ }
      emit(event: string) { /* ... */ }
    }
  `,
  'qa/fp_namespace.ts': `
    export const Utils = {
      format: (value: string) => value.trim(),
      parse: (input: string) => JSON.parse(input),
    };
  `,
  'qa/fp_async.ts': `
    export async function FetchData(url: string) {
      const response = await fetch(url);
      return response.json();
    }
  `,

  // =========================================================================
  // Path 1 tests: resolvePropsFromStoryFile (JSX-based extraction)
  // =========================================================================
  'path1/Button.tsx': `
    import React from 'react';
    interface ButtonProps {
      /** The button label */
      label: string;
      variant?: 'solid' | 'outline';
      disabled?: boolean;
    }
    export const Button = (props: ButtonProps) => <button>{props.label}</button>;
  `,
  'path1/Button.stories.tsx': `
    import React from 'react';
    import { Button } from './Button';
    export default { component: Button };
    export const Default = () => <Button label="Click me" variant="solid" />;
  `,

  'path1/GenericList.tsx': `
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
  'path1/GenericList.stories.tsx': `
    import React from 'react';
    import { GenericList } from './GenericList';
    export default { component: GenericList };
    export const StringList = () => (
      <GenericList items={['a', 'b']} renderItem={(s) => <li>{s}</li>} />
    );
  `,

  'path1/ForwardRefButton.tsx': `
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
  'path1/ForwardRefButton.stories.tsx': `
    import React from 'react';
    import { ForwardRefButton } from './ForwardRefButton';
    export default { component: ForwardRefButton };
    export const Default = () => <ForwardRefButton text="Hello" size="md" />;
  `,

  'path1/MemoButton.tsx': `
    import React from 'react';
    interface MemoButtonProps {
      /** The label */
      label: string;
      color?: string;
    }
    const Inner = (props: MemoButtonProps) => <button>{props.label}</button>;
    export const MemoButton = React.memo(Inner);
  `,
  'path1/MemoButton.stories.tsx': `
    import React from 'react';
    import { MemoButton } from './MemoButton';
    export default { component: MemoButton };
    export const Default = () => <MemoButton label="Click" color="blue" />;
  `,

  'path1/Compound.tsx': `
    import React from 'react';
    interface RootProps {
      /** Whether multiple items can be open */
      multiple?: boolean;
    }
    const Root = (props: RootProps) => <div />;
    interface ItemProps {
      value: string;
      disabled?: boolean;
    }
    const Item = (props: ItemProps) => <div />;
    export const Accordion = { Root, Item };
  `,
  'path1/Compound.stories.tsx': `
    import React from 'react';
    import { Accordion } from './Compound';
    export default { component: Accordion };
    export const Default = () => (
      <Accordion.Root multiple>
        <Accordion.Item value="a" />
      </Accordion.Root>
    );
  `,

  'path1/DefaultExport.tsx': `
    import React from 'react';
    interface HeaderProps {
      /** The title text */
      title: string;
      subtitle?: string;
    }
    const Header = (props: HeaderProps) => <header>{props.title}</header>;
    export default Header;
  `,
  'path1/DefaultExport.stories.tsx': `
    import React from 'react';
    import Header from './DefaultExport';
    export default { component: Header };
    export const Default = () => <Header title="Welcome" subtitle="Hi" />;
  `,
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let project: ComponentMetaProject;
let tempDir: string;
let filePaths: Record<string, string>;

/** Recursively delete a directory using ts.sys (bypasses memfs mock). */
function rmrf(dir: string) {
  if (!sys.directoryExists(dir)) {
    return;
  }
  for (const entry of sys.readDirectory(dir, undefined, undefined, ['**/*'])) {
    sys.deleteFile!(entry);
  }
  // Directories are left empty — OS/CI cleans up, .gitignore prevents commits
}

beforeAll(() => {
  // Create temp project under monorepo root for node_modules resolution
  const fixturesDir = path.join(MONOREPO_ROOT, '.test-fixtures');
  sys.createDirectory(fixturesDir);
  tempDir = path.join(
    fixturesDir,
    `lsp-propext-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  sys.createDirectory(tempDir);

  // Write all test files
  filePaths = {};
  for (const [name, content] of Object.entries(TEST_FILES)) {
    const fp = path.join(tempDir, name);
    // Ensure parent directories exist
    const dir = path.dirname(fp);
    if (!sys.directoryExists(dir)) {
      // Create nested dirs one level at a time
      const parts = path.relative(tempDir, dir).split(path.sep);
      let current = tempDir;
      for (const part of parts) {
        current = path.join(current, part);
        if (!sys.directoryExists(current)) {
          sys.createDirectory(current);
        }
      }
    }
    sys.writeFile(fp, content);
    filePaths[name] = fp;
  }

  // Write tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      moduleResolution: 'bundler',
    },
    include: ['./**/*.ts', './**/*.tsx'],
  };
  const configPath = path.join(tempDir, 'tsconfig.json');
  sys.writeFile(configPath, JSON.stringify(tsconfig, null, 2));

  // Parse and create a single shared project
  const parsed = ts.parseJsonSourceFileConfigFileContent(
    ts.readJsonConfigFile(configPath, sys.readFile),
    sys,
    tempDir,
    {},
    configPath
  );
  project = new ComponentMetaProject(ts, parsed, configPath);
});

afterAll(() => {
  project?.dispose();
  if (tempDir) {
    rmrf(tempDir);
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Discover all value export names from a source file's AST.
 * Used by the docs() helper to build extraction entries without needing
 * a public "discover exports" method on ComponentMetaProject.
 */
function findExportNames(sourceFile: ts.SourceFile): string[] {
  const names: string[] = [];

  for (const stmt of sourceFile.statements) {
    // export default X (export assignment)
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      names.push('default');
      continue;
    }

    // export { X, Y, Z } or export { X } from './foo'
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const spec of stmt.exportClause.elements) {
          names.push(spec.name.text);
        }
      }
      continue;
    }

    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    if (!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;

    if (mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      names.push('default');
      continue;
    }

    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      names.push(stmt.name.text);
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      names.push(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          names.push(decl.name.text);
        }
      }
    } else if (ts.isEnumDeclaration(stmt)) {
      names.push(stmt.name.text);
    }
  }

  return [...new Set(names)];
}

/**
 * Extract docs for a test file by its key in TEST_FILES.
 * Discovers all exports from the file's AST and uses extractPropsFromStories
 * with Path 2 fallback (no importId → skips story JSX lookup).
 */
function docs(fileName: string): ComponentDoc[] {
  const fp = filePaths[fileName];
  if (!fp) {
    throw new Error(`Unknown test file: "${fileName}"`);
  }

  // Discover export names from the file's AST
  const text = sys.readFile(fp);
  if (!text) return [];
  const sf = ts.createSourceFile(fp, text, ts.ScriptTarget.Latest, true);
  const exportNames = findExportNames(sf);

  // Use extractPropsFromStories with Path 2 (no importId → direct type inspection)
  const entries = exportNames.map((name) => ({
    storyFilePath: fp,
    componentPath: fp,
    exportName: name,
  }));
  const results = project.extractPropsFromStories(entries);
  const storyMap = results.get(fp);
  if (!storyMap) return [];
  const allDocs: ComponentDoc[] = [];
  for (const [, d] of storyMap) {
    allDocs.push(...d);
  }
  return allDocs;
}

/** Get detected component export names for a test file. */
function detectNames(fileName: string): string[] {
  return docs(fileName)
    .map((d) => d.exportName)
    .sort();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('component detection (LSP)', () => {
  describe('function components', () => {
    it('detects arrow function component', () => {
      expect(detectNames('detect/arrow.tsx')).toEqual(['Button']);
    });

    it('detects function declaration component', () => {
      expect(detectNames('detect/function.tsx')).toEqual(['Button']);
    });

    it('detects component returning null', () => {
      expect(detectNames('detect/null_return.tsx')).toEqual(['Empty']);
    });

    it('detects component with no props', () => {
      expect(detectNames('detect/no_props.tsx')).toEqual(['Logo']);
    });
  });

  describe('class components', () => {
    it('detects class extending React.Component', () => {
      expect(detectNames('detect/class_component.tsx')).toEqual(['Button']);
    });

    it('detects class extending React.PureComponent', () => {
      expect(detectNames('detect/class_pure.tsx')).toEqual(['Button']);
    });
  });

  describe('wrapped components', () => {
    it('detects React.memo', () => {
      expect(detectNames('detect/memo.tsx')).toEqual(['Button']);
    });

    it('detects React.forwardRef', () => {
      expect(detectNames('detect/forwardref.tsx')).toEqual(['Button']);
    });

    it('detects React.memo(React.forwardRef(...))', () => {
      expect(detectNames('detect/memo_forwardref.tsx')).toEqual(['Button']);
    });

    it('detects React.lazy', () => {
      expect(detectNames('detect/lazy/Lazy.tsx')).toEqual(['LazyButton']);
    });
  });

  describe('default exports', () => {
    it('detects default exported component', () => {
      expect(detectNames('detect/default.tsx')).toEqual(['default']);
    });

    it('detects inline default export', () => {
      expect(detectNames('detect/default_inline.tsx')).toEqual(['default']);
    });

    it('detects default export function declaration', () => {
      expect(detectNames('detect/default_function.tsx')).toEqual(['default']);
    });
  });

  describe('non-components', () => {
    it('rejects plain object', () => {
      expect(detectNames('detect/plain_object.ts')).toEqual([]);
    });

    it('rejects lowercase exports (JSX intrinsic rule)', () => {
      expect(detectNames('detect/lowercase.tsx')).toEqual([]);
    });

    it('rejects string constant', () => {
      expect(detectNames('detect/string_const.ts')).toEqual([]);
    });

    it('rejects number constant', () => {
      expect(detectNames('detect/number_const.ts')).toEqual([]);
    });

    it('rejects array', () => {
      expect(detectNames('detect/array_const.ts')).toEqual([]);
    });

    it('rejects type-only exports', () => {
      expect(detectNames('detect/type_only.ts')).toEqual([]);
    });

    it('rejects class not extending Component', () => {
      expect(detectNames('detect/class_non_component.ts')).toEqual([]);
    });
  });

  describe('RDT false positives', () => {
    it('rejects lowercase function (RDT bug: detects any single-param fn)', () => {
      expect(detectNames('detect/fp_lowercase.ts')).toEqual([]);
    });

    it('accepts uppercase function returning ReactNode-assignable value', () => {
      expect(detectNames('detect/fp_formatdate.ts')).toEqual(['FormatDate']);
    });

    it('accepts function with primitive "props" param returning ReactNode', () => {
      expect(detectNames('detect/fp_parseprops.ts')).toEqual(['ParseProps']);
    });

    it('rejects hook returning non-ReactNode object', () => {
      expect(detectNames('detect/fp_usecounter.ts')).toEqual([]);
    });

    it('rejects higher-order function returning non-component', () => {
      expect(detectNames('detect/fp_createvalidator.ts')).toEqual([]);
    });

    it('rejects enum-like const object', () => {
      expect(detectNames('detect/fp_buttonvariant.ts')).toEqual([]);
    });
  });

  describe('mixed exports', () => {
    it('only detects components among mixed exports', () => {
      expect(detectNames('detect/mixed.tsx')).toEqual(['Button', 'Icon']);
    });

    it('detects components alongside type exports', () => {
      expect(detectNames('detect/mixed_types.tsx')).toEqual(['Button']);
    });
  });
});

describe('componentMetaExtractor (LSP)', () => {
  describe('component detection', () => {
    it('detects a named arrow function component', () => {
      const result = docs('extract/arrow.tsx');
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Button');
      expect(result[0].exportName).toBe('Button');
    });

    it('detects a named function declaration component', () => {
      const result = docs('extract/function.tsx');
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Button');
    });

    it('detects a default exported component', () => {
      const result = docs('extract/default.tsx');
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Button');
      expect(result[0].exportName).toBe('default');
    });

    it('skips non-component exports (lowercase)', () => {
      expect(docs('extract/skip_lowercase.ts')).toHaveLength(0);
    });

    it('skips non-component uppercase exports (no valid props)', () => {
      expect(docs('extract/skip_config.ts')).toHaveLength(0);
    });

    it('detects multiple component exports', () => {
      const result = docs('extract/multi.tsx');
      expect(result).toHaveLength(2);
      expect(result.map((d) => d.displayName).sort()).toEqual(['Button', 'Icon']);
    });
  });

  describe('props extraction', () => {
    it('extracts basic prop types', () => {
      const result = docs('extract/basic_types.tsx');
      expect(result).toHaveLength(1);
      const { props } = result[0];

      expect(props.label).toBeDefined();
      expect(props.label.type.name).toBe('string');
      expect(props.label.required).toBe(true);

      expect(props.count).toBeDefined();
      expect(props.count.type.name).toBe('number');
      expect(props.count.required).toBe(true);

      expect(props.disabled).toBeDefined();
      expect(props.disabled.type.name).toBe('boolean');
      expect(props.disabled.required).toBe(false);
    });

    it('extracts string literal union as enum', () => {
      const { props } = docs('extract/string_enum.tsx')[0];
      expect(props.size.type.name).toBe('enum');
      // Union member ordering may differ between JSX-resolved and parameter-resolved types
      expect(props.size.type.value).toHaveLength(3);
      expect(props.size.type.value).toEqual(
        expect.arrayContaining([{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }])
      );
    });

    it('extracts optional string literal union as enum', () => {
      const { props } = docs('extract/optional_enum.tsx')[0];
      expect(props.size.type.name).toBe('enum');
      expect(props.size.required).toBe(false);
      // Should not include undefined in enum values
      // Union member ordering may differ between JSX-resolved and parameter-resolved types
      expect(props.size.type.value).toHaveLength(3);
      expect(props.size.type.value).toEqual(
        expect.arrayContaining([{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }])
      );
    });

    it('extracts JSDoc descriptions', () => {
      const { props } = docs('extract/jsdoc.tsx')[0];
      expect(props.label.description).toBe('The button label text');
      expect(props.primary.description).toBe('Whether the button is in primary style');
    });

    it('extracts component-level JSDoc description', () => {
      const result = docs('extract/component_jsdoc.tsx');
      expect(result[0].description).toBe('Primary UI component for user interaction');
    });
  });

  describe('parent/source info', () => {
    it('attaches parent type info to props from named interfaces', () => {
      const { props } = docs('extract/parent_named.tsx')[0];
      expect(props.label.parent?.name).toBe('ButtonProps');
    });

    it('attaches declarations with TypeLiteral for inline types', () => {
      const { props } = docs('extract/parent_inline.tsx')[0];
      expect(props.label.declarations).toBeDefined();
    });

    it('resolves parent through intersection type literals', () => {
      const { props } = docs('extract/parent_typeliteral_intersection.tsx')[0];
      expect(props.variant.parent?.name).toBe('ButtonProps');
      expect(props.loading.parent?.name).toBe('BaseProps');
    });

    it('resolves parent for forwardRef with polymorphic as-cast', () => {
      const { props } = docs('extract/parent_polymorphic_cast.tsx')[0];
      expect(props.variant.parent?.name).toBe('ButtonProps');
      expect(props.loading.parent?.name).toBe('BaseProps');
    });
  });

  describe('display name', () => {
    it('uses export name for named exports', () => {
      expect(docs('extract/dn_named.tsx')[0].displayName).toBe('MyButton');
    });

    it('uses resolved symbol name for default exports', () => {
      expect(docs('extract/dn_default.tsx')[0].displayName).toBe('MyButton');
    });

    it('falls back to filename for anonymous default exports', () => {
      expect(docs('extract/dn/Widget.tsx')[0].displayName).toBe('Widget');
    });

    it('uses parent directory for anonymous default exports from index.ts', () => {
      expect(docs('extract/dn/TextInput/index.ts')[0].displayName).toBe('TextInput');
    });
  });

  describe('defaultValue', () => {
    it('extracts destructuring defaults from arrow function', () => {
      const { props } = docs('extract/dv_destructuring.tsx')[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.color.defaultValue).toEqual({ value: "'blue'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts defaults from forwardRef', () => {
      const { props } = docs('extract/dv_forwardref.tsx')[0];
      expect(props.variant.defaultValue).toEqual({ value: "'primary'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts JSDoc @default tags', () => {
      const { props } = docs('extract/dv_jsdoc.tsx')[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts defaults from body-level destructuring in forwardRef', () => {
      const { props } = docs('extract/dv_body_destructuring.tsx')[0];
      expect(props.color.defaultValue).toEqual({ value: "'info'" });
      expect(props.rounded.defaultValue).toEqual({ value: 'true' });
      expect(props.label.defaultValue).toBeNull();
    });

    it('resolves identifier references to literal values', () => {
      const { props } = docs('extract/dv_identifier_resolution.tsx')[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.count.defaultValue).toEqual({ value: '42' });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts Component.defaultProps expression pattern', () => {
      const { props } = docs('extract/dv_defaultprops.tsx')[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.color.defaultValue).toEqual({ value: "'blue'" });
      expect(props.label.defaultValue).toBeNull();
    });

    it('extracts static defaultProps from class components', () => {
      const { props } = docs('extract/dv_static_defaultprops.tsx')[0];
      expect(props.size.defaultValue).toEqual({ value: "'md'" });
      expect(props.label.defaultValue).toBeNull();
    });
  });

  describe('fixture: Button component', () => {
    it('extracts the standard Storybook Button fixture', () => {
      const result = docs('extract/fixture_button.tsx');
      expect(result).toHaveLength(1);
      const doc = result[0];

      expect(doc.displayName).toBe('Button');
      expect(doc.exportName).toBe('Button');
      expect(doc.description).toContain('Primary UI component for user interaction');

      // Props
      expect(doc.props.primary).toBeDefined();
      expect(doc.props.primary.required).toBe(false);
      expect(doc.props.primary.type.name).toBe('boolean');
      expect(doc.props.primary.description).toBe('Description of primary');

      expect(doc.props.label).toBeDefined();
      expect(doc.props.label.required).toBe(true);
      expect(doc.props.label.type.name).toBe('string');

      expect(doc.props.size).toBeDefined();
      expect(doc.props.size.required).toBe(false);
      expect(doc.props.size.type.name).toBe('enum');
      // Union member ordering may differ between JSX-resolved and parameter-resolved types
      expect(doc.props.size.type.value).toHaveLength(3);
      expect(doc.props.size.type.value).toEqual(
        expect.arrayContaining([{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }])
      );

      expect(doc.props.backgroundColor).toBeDefined();
      expect(doc.props.backgroundColor.required).toBe(false);
      expect(doc.props.backgroundColor.type.name).toBe('string');

      expect(doc.props.onClick).toBeDefined();
      expect(doc.props.onClick.required).toBe(false);

      // Default values from destructuring
      expect(doc.props.primary.defaultValue).toEqual({ value: 'false' });
      expect(doc.props.size.defaultValue).toEqual({ value: "'medium'" });
      expect(doc.props.backgroundColor.defaultValue).toBeNull();
      expect(doc.props.label.defaultValue).toBeNull();
    });
  });

  describe('fixture: Header component (default export)', () => {
    it('extracts a default-exported component', () => {
      const result = docs('extract/fixture/Header.tsx');
      expect(result).toHaveLength(1);
      const doc = result[0];

      // Default export — should use filename as display name
      expect(doc.exportName).toBe('default');
      expect(doc.displayName).toBe('Header');

      // Props
      expect(doc.props.user).toBeDefined();
      expect(doc.props.user.required).toBe(false);

      expect(doc.props.onLogin).toBeDefined();
      expect(doc.props.onLogin.required).toBe(false);

      expect(doc.props.onLogout).toBeDefined();
      expect(doc.props.onLogout.required).toBe(false);

      expect(doc.props.onCreateAccount).toBeDefined();
      expect(doc.props.onCreateAccount.required).toBe(false);
    });
  });

  describe('class components', () => {
    it('detects a class component', () => {
      const result = docs('extract/class.tsx');
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Button');
      expect(result[0].props.label).toBeDefined();
      expect(result[0].props.label.required).toBe(true);
      expect(result[0].props.label.type.name).toBe('string');
    });
  });

  describe('memo and forwardRef', () => {
    it('detects a React.memo component', () => {
      const result = docs('extract/memo.tsx');
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Button');
      expect(result[0].props.label).toBeDefined();
    });

    it('detects a React.forwardRef component', () => {
      const result = docs('extract/forwardref.tsx');
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Button');
      expect(result[0].props.label).toBeDefined();
    });
  });

  describe('intersection types', () => {
    it('extracts props from intersection types', () => {
      const result = docs('extract/intersection.tsx');
      expect(result).toHaveLength(1);
      const { props } = result[0];
      expect(props.id).toBeDefined();
      expect(props.className).toBeDefined();
      expect(props.label).toBeDefined();
    });
  });

  describe('props extraction edge cases', () => {
    it('extracts Pick<> props correctly', () => {
      const { props } = docs('extract/pick.tsx')[0];
      expect(Object.keys(props).sort()).toEqual(['id', 'label']);
      expect(props.id.type.name).toBe('string');
      expect(props.label.type.name).toBe('string');
    });

    it('extracts Omit<> props correctly', () => {
      const { props } = docs('extract/omit.tsx')[0];
      expect(Object.keys(props).sort()).toEqual(['id', 'label']);
    });

    it('extracts Partial<> props as all optional', () => {
      const { props } = docs('extract/partial.tsx')[0];
      expect(props.label.required).toBe(false);
      expect(props.count.required).toBe(false);
    });

    it('extracts Required<> props as all required', () => {
      const { props } = docs('extract/required.tsx')[0];
      expect(props.label.required).toBe(true);
      expect(props.count.required).toBe(true);
    });

    it('extracts extends interface props', () => {
      const { props } = docs('extract/extends.tsx')[0];
      expect(props.id).toBeDefined();
      expect(props.id.required).toBe(true);
      expect(props.label).toBeDefined();
      expect(props.variant).toBeDefined();
      expect(props.variant.type.name).toBe('enum');
    });

    it('extracts generic component props', () => {
      const { props } = docs('extract/generic.tsx')[0];
      expect(props.items).toBeDefined();
      expect(props.items.type.name).toBe('string[]');
      expect(props.renderItem).toBeDefined();
    });

    it('extracts number literal union as enum', () => {
      const { props } = docs('extract/number_enum.tsx')[0];
      expect(props.columns.type.name).toBe('enum');
      expect(props.columns.type.value).toEqual([
        { value: '1' },
        { value: '2' },
        { value: '3' },
        { value: '4' },
      ]);
    });

    it('extracts mixed union (string | number) as type string, not enum', () => {
      const { props } = docs('extract/mixed_union.tsx')[0];
      expect(props.value.type.name).toBe('string | number');
    });

    it('extracts function prop types', () => {
      const { props } = docs('extract/function_props.tsx')[0];
      expect(props.onClick.type.name).toBe('() => void');
      expect(props.onChange.type.name).toBe('(value: string) => void');
    });

    it('extracts complex nested object props', () => {
      const { props } = docs('extract/nested_object.tsx')[0];
      expect(props.theme).toBeDefined();
      expect(props.theme.type.name).toBe('Theme');
      expect(props.label.type.name).toBe('string');
    });

    it('extracts React.ReactNode and React.ReactElement prop types', () => {
      const { props } = docs('extract/reactnode.tsx')[0];
      expect(props.children).toBeDefined();
      expect(props.children.required).toBe(true);
      expect(props.icon).toBeDefined();
      expect(props.header).toBeDefined();
      expect(props.header.required).toBe(false);
    });

    it('handles component extending HTML element props with >30 filter', () => {
      const { props } = docs('extract/html_extends.tsx')[0];
      // User-defined props should be present
      expect(props.variant).toBeDefined();
      expect(props.label).toBeDefined();
      // HTMLButtonElement has >30 props from node_modules — should be filtered
      expect(props.onClick).toBeUndefined();
      expect(props.className).toBeUndefined();
    });

    it('preserves small HTML element extends (under threshold)', () => {
      const { props } = docs('extract/small_html.tsx')[0];
      expect(props.label).toBeDefined();
      // Pick with only 2 HTML props — under threshold, should be kept
      expect(props.disabled).toBeDefined();
      expect(props.type).toBeDefined();
    });

    it('extracts forwardRef component props without ref/key noise', () => {
      const { props } = docs('extract/forwardref_props.tsx')[0];
      expect(props.label).toBeDefined();
      expect(props.variant).toBeDefined();
      // ref and key come from RefAttributes — only 2 props, under >30 threshold
      // so they'll be present. That's expected.
    });
  });

  describe('source/parent tracking', () => {
    it('tracks parent through intersection types', () => {
      const { props } = docs('extract/parent_intersection.tsx')[0];

      // Props from named interfaces track their parent
      expect(props.id.parent?.name).toBe('BaseProps');
      expect(props.id.description).toBe('Unique identifier');

      expect(props.className.parent?.name).toBe('StyleProps');
      expect(props.className.description).toBe('Custom CSS class');

      // Inline type literal
      expect(props.label.description).toBe('The label');
    });

    it('tracks parent through extends', () => {
      const { props } = docs('extract/parent_extends.tsx')[0];
      expect(props.id.parent?.name).toBe('BaseProps');
      expect(props.id.description).toBe('Unique identifier');
      expect(props.label.parent?.name).toBe('ButtonProps');
    });

    it('tracks declarations from multiple sources', () => {
      const { props } = docs('extract/parent_multi_decl.tsx')[0];
      // 'shared' is declared in both A and B
      expect(props.shared.declarations).toBeDefined();
      expect(props.shared.declarations!.length).toBeGreaterThanOrEqual(2);
      const names = props.shared.declarations!.map((d) => d.name).sort();
      expect(names).toEqual(['A', 'B']);
    });

    it('source file is set for >30 filter', () => {
      const { props } = docs('extract/parent_filter.tsx')[0];
      // variant is our own prop — should survive the >30 filter
      expect(props.variant).toBeDefined();
      expect(props.variant.parent?.name).toBe('ButtonProps');
      expect(props.variant.description).toBe('Custom variant');

      // onClick etc from ButtonHTMLAttributes are >30 per source file — filtered out
      expect(props.onClick).toBeUndefined();
    });
  });

  describe('type flattening (getApparentProperties)', () => {
    it('flattens Pick<> to concrete props', () => {
      const { props } = docs('extract/flat_pick.tsx')[0];
      expect(Object.keys(props).sort()).toEqual(['a', 'b']);
      expect(props.a.type.name).toBe('string');
      expect(props.b.type.name).toBe('number');
    });

    it('flattens Omit<> to concrete props', () => {
      const { props } = docs('extract/flat_omit.tsx')[0];
      expect(Object.keys(props).sort()).toEqual(['a', 'b']);
    });

    it('flattens intersection to all member props', () => {
      const { props } = docs('extract/flat_intersection.tsx')[0];
      expect(Object.keys(props).sort()).toEqual(['x', 'y']);
      expect(props.x.type.name).toBe('string');
      expect(props.y.type.name).toBe('number');
    });

    it('flattens complex Pick & Omit combination', () => {
      const { props } = docs('extract/flat_complex.tsx')[0];
      expect(props.a).toBeDefined();
      expect(props.b).toBeDefined();
      expect(props.c).toBeDefined();
      expect(props.extra).toBeDefined();
      expect(props.d).toBeUndefined(); // omitted
    });

    it('resolves generic instantiation to concrete types', () => {
      const { props } = docs('extract/flat_generic.tsx')[0];
      expect(props.items.type.name).toBe('number[]');
      expect(props.selected.type.name).toBe('number');
    });

    it('collects all props from discriminated union (Reshaped Slider pattern)', () => {
      const { props } = docs('extract/discriminated_union.tsx')[0];
      // Base props present in all variants
      expect(props.min).toBeDefined();
      expect(props.max).toBeDefined();
      expect(props.step).toBeDefined();
      expect(props.min.required).toBe(false);

      // Union-specific props — collected from all variants
      expect(props.value).toBeDefined();
      expect(props.defaultValue).toBeDefined();

      // Types should be `number`, not `undefined` (must pick non-never variant)
      expect(props.value.type.name).toBe('number');
      expect(props.defaultValue.type.name).toBe('number');

      // Required should be false — each prop is `never` in one variant
      expect(props.value.required).toBe(false);
      expect(props.defaultValue.required).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// QA failure patterns — tests for patterns that react-docgen-typescript
// fails on in real design systems.
// ---------------------------------------------------------------------------

describe('QA: patterns RDT fails on (LSP)', () => {
  describe('Pattern 1: ForwardRefExoticComponent from HOC factory (Park UI)', () => {
    it('detects component returned by withProvider HOC', () => {
      const result = docs('qa/park_provider.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Root');
      expect(result[0].props).toHaveProperty('items');
      expect(result[0].props).toHaveProperty('multiple');
      expect(result[0].props.items.required).toBe(true);
      expect(result[0].props.multiple.required).toBe(false);
      expect(result[0].props.items.description).toBe('The accordion items');
    });

    it('detects component returned by withContext HOC', () => {
      const result = docs('qa/park_context.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('ItemTrigger');
      expect(result[0].props).toHaveProperty('onClick');
    });

    it('detects multiple HOC-wrapped sub-components in one file', () => {
      const result = docs('qa/park_accordion.tsx');

      expect(result).toHaveLength(3);
      const names = result.map((d) => d.displayName).sort();
      expect(names).toEqual(['Item', 'ItemTrigger', 'Root']);

      const item = result.find((d) => d.displayName === 'Item')!;
      expect(item.props.value.required).toBe(true);
      expect(item.props.disabled.required).toBe(false);
    });
  });

  describe('Pattern 2: as-cast with marker intersection (Primer)', () => {
    it('detects component after as WithSlotMarker cast', () => {
      const result = docs('qa/primer_slot_marker.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].props).toHaveProperty('checked');
      expect(result[0].props).toHaveProperty('onChange');
      expect(result[0].props).toHaveProperty('disabled');
      expect(result[0].props.checked.description).toBe('Whether the checkbox is checked');
    });
  });

  describe('Pattern 3: as PolymorphicForwardRefComponent (Primer)', () => {
    it('detects component cast to polymorphic forwardRef interface', () => {
      const result = docs('qa/primer_polymorphic.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].exportName).toBe('Button');
      expect(result[0].props).toHaveProperty('variant');
      expect(result[0].props).toHaveProperty('size');
      expect(result[0].props.variant.description).toBe('Button variant style');
    });

    it('extracts destructuring defaults from forwardRef with as-cast', () => {
      const result = docs('qa/primer_polymorphic_defaults.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].exportName).toBe('Stack');
      // Destructuring defaults should take priority over JSDoc @default
      expect(result[0].props.direction.defaultValue).toEqual({ value: "'vertical'" });
      expect(result[0].props.align.defaultValue).toEqual({ value: "'stretch'" });
      expect(result[0].props.wrap.defaultValue).toEqual({ value: "'nowrap'" });
    });
  });

  describe('Pattern 4: Object.assign compound component (Primer)', () => {
    it('detects component from Object.assign compound export', () => {
      const result = docs('qa/primer_object_assign.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].props).toHaveProperty('id');
      expect(result[0].props).toHaveProperty('required');
      expect(result[0].props).toHaveProperty('disabled');
      expect(result[0].props.id.required).toBe(true);
      expect(result[0].props.id.description).toBe('Unique identifier');
      // Sub-components should NOT appear as props
      expect(result[0].props).not.toHaveProperty('Caption');
      expect(result[0].props).not.toHaveProperty('Label');
    });

    it('extracts destructuring defaults through Object.assign', () => {
      const result = docs('qa/primer_stack/Stack.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].exportName).toBe('Stack');
      // Destructuring defaults should win over JSDoc @default
      expect(result[0].props.direction.defaultValue).toEqual({ value: "'vertical'" });
      expect(result[0].props.align.defaultValue).toEqual({ value: "'stretch'" });
      expect(result[0].props.wrap.defaultValue).toEqual({ value: "'nowrap'" });
    });
  });

  describe('Pattern 5: aliased barrel re-export (Primer)', () => {
    it('detects component through aliased re-export', () => {
      const result = docs('qa/barrel/index.ts');

      expect(result).toHaveLength(1);
      expect(result[0].exportName).toBe('Button');
      expect(result[0].props).toHaveProperty('label');
      expect(result[0].props).toHaveProperty('variant');
      expect(result[0].props.label.required).toBe(true);
      expect(result[0].props.variant.type.name).toBe('enum');
    });
  });

  describe('Pattern 6: empty interface with deep extends (Mantine)', () => {
    it('extracts props from empty interface extending multiple bases', () => {
      const result = docs('qa/mantine_textinput.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('TextInput');
      // Props from BaseInputProps
      expect(result[0].props).toHaveProperty('label');
      expect(result[0].props).toHaveProperty('error');
      expect(result[0].props).toHaveProperty('description');
      // Props from BoxProps
      expect(result[0].props).toHaveProperty('component');
      // Props from StylesApiProps
      expect(result[0].props).toHaveProperty('className');
      expect(result[0].props).toHaveProperty('style');
      // HTML input props should be filtered by >30 threshold
      expect(result[0].props).not.toHaveProperty('onChange');
      expect(result[0].props).not.toHaveProperty('onBlur');
    });
  });

  describe('Pattern 7: factory() wrapping forwardRef internally (Mantine)', () => {
    it('detects component from factory HOC', () => {
      const result = docs('qa/mantine_factory.tsx');

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Select');
      expect(result[0].props).toHaveProperty('value');
      expect(result[0].props).toHaveProperty('onChange');
      expect(result[0].props).toHaveProperty('data');
      expect(result[0].props).toHaveProperty('searchable');
      expect(result[0].props.data.required).toBe(true);
      expect(result[0].props.searchable.required).toBe(false);
      expect(result[0].props.value.description).toBe('Currently selected value');
    });
  });

  describe('Pattern 8: false positive rejection', () => {
    it('rejects utility function with single object param', () => {
      expect(detectNames('qa/fp_utility.ts')).toEqual([]);
    });

    it('rejects higher-order function returning non-component', () => {
      expect(detectNames('qa/fp_hof.ts')).toEqual([]);
    });

    it('rejects class not extending React.Component', () => {
      expect(detectNames('qa/fp_class.ts')).toEqual([]);
    });

    it('rejects namespace-like const object', () => {
      expect(detectNames('qa/fp_namespace.ts')).toEqual([]);
    });

    it('rejects async function returning non-ReactNode', () => {
      expect(detectNames('qa/fp_async.ts')).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Path 1: resolvePropsFromStoryFile — JSX-based extraction
// ---------------------------------------------------------------------------

describe('Path 1: resolvePropsFromStoryFile (JSX-based extraction)', () => {
  /** Extract via story JSX for a given component/story pair. */
  function storyDocs(
    storyFile: string,
    componentFile: string,
    exportName: string,
    importId?: string,
    memberAccess?: string
  ): ComponentDoc[] {
    const storyPath = filePaths[storyFile];
    const componentPath = filePaths[componentFile];
    if (!storyPath || !componentPath) {
      throw new Error(`Unknown test files: "${storyFile}" / "${componentFile}"`);
    }
    const results = project.extractPropsFromStories([
      {
        storyFilePath: storyPath,
        componentPath,
        exportName,
        importId: importId ?? `./${path.basename(componentFile, '.tsx')}`,
        memberAccess,
      },
    ]);
    return results.get(storyPath)?.get(exportName) ?? [];
  }

  it('extracts props from a simple component via story JSX', () => {
    const result = storyDocs('path1/Button.stories.tsx', 'path1/Button.tsx', 'Button');

    expect(result).toHaveLength(1);
    expect(result[0].displayName).toBe('Button');
    expect(result[0].props.label).toBeDefined();
    expect(result[0].props.label.type.name).toBe('string');
    expect(result[0].props.label.required).toBe(true);
    expect(result[0].props.label.description).toBe('The button label');
    expect(result[0].props.variant).toBeDefined();
    expect(result[0].props.variant.type.name).toBe('enum');
    expect(result[0].props.disabled).toBeDefined();
    expect(result[0].props.disabled.required).toBe(false);
  });

  it('extracts props from a generic component (TS instantiates generics)', () => {
    const result = storyDocs(
      'path1/GenericList.stories.tsx',
      'path1/GenericList.tsx',
      'GenericList'
    );

    expect(result).toHaveLength(1);
    expect(result[0].props.items).toBeDefined();
    expect(result[0].props.renderItem).toBeDefined();
    expect(result[0].props.title).toBeDefined();
    expect(result[0].props.title.required).toBe(false);
  });

  it('extracts props from a forwardRef component via story JSX', () => {
    const result = storyDocs(
      'path1/ForwardRefButton.stories.tsx',
      'path1/ForwardRefButton.tsx',
      'ForwardRefButton'
    );

    expect(result).toHaveLength(1);
    expect(result[0].props.text).toBeDefined();
    expect(result[0].props.text.description).toBe('Button text');
    expect(result[0].props.size).toBeDefined();
    expect(result[0].props.size.type.name).toBe('enum');
  });

  it('extracts props from a memo component via story JSX', () => {
    const result = storyDocs('path1/MemoButton.stories.tsx', 'path1/MemoButton.tsx', 'MemoButton');

    expect(result).toHaveLength(1);
    expect(result[0].props.label).toBeDefined();
    expect(result[0].props.label.description).toBe('The label');
    expect(result[0].props.color).toBeDefined();
  });

  it('extracts props for compound component member via story JSX', () => {
    const result = storyDocs(
      'path1/Compound.stories.tsx',
      'path1/Compound.tsx',
      'Accordion',
      './Compound',
      'Root'
    );

    expect(result).toHaveLength(1);
    expect(result[0].props.multiple).toBeDefined();
    expect(result[0].props.multiple.description).toBe('Whether multiple items can be open');
    // Should NOT have Item props
    expect(result[0].props.value).toBeUndefined();
    expect(result[0].props.disabled).toBeUndefined();
  });

  it('extracts props from a default export via story JSX', () => {
    const result = storyDocs(
      'path1/DefaultExport.stories.tsx',
      'path1/DefaultExport.tsx',
      'default'
    );

    expect(result).toHaveLength(1);
    expect(result[0].props.title).toBeDefined();
    expect(result[0].props.title.description).toBe('The title text');
    expect(result[0].props.subtitle).toBeDefined();
    expect(result[0].props.subtitle.required).toBe(false);
  });
});
