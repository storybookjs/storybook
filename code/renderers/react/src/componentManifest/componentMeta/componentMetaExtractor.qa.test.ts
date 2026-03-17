import { describe, expect, it } from 'vitest';

import { extract, extractFromStory } from './componentMetaExtractor.test-helpers';

describe('real-world component patterns', () => {
  describe('ForwardRefExoticComponent from HOC factory (Park UI)', () => {
    it('detects component returned by withProvider HOC', () => {
      const doc = extract(
        'Root',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'Root',
        exportName: 'Root',
        props: {
          items: {
            description: 'The accordion items',
            parent: { name: 'RootProps' },
            required: true,
            type: { name: 'string[]' },
          },
          multiple: {
            description: 'Whether multiple items can be open',
            parent: { name: 'RootProps' },
            required: false,
            type: { name: 'boolean | undefined' },
          },
        },
      });
    });

    it('detects component returned by withContext HOC', () => {
      const doc = extract(
        'ItemTrigger',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'ItemTrigger',
        exportName: 'ItemTrigger',
        props: {
          onClick: {
            description: 'Click handler',
            parent: { name: 'ItemTriggerProps' },
            required: false,
            type: { name: '() => void' },
          },
        },
      });
    });

    it('detects multiple HOC-wrapped sub-components in one file', () => {
      const componentSource = `
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
      `;

      const root = extract('Root', componentSource);
      expect(root).toMatchObject({
        displayName: 'Root',
        exportName: 'Root',
        props: {
          multiple: {
            parent: { name: 'RootProps' },
            required: false,
            type: { name: 'boolean | undefined' },
          },
        },
      });

      const item = extract('Item', componentSource);
      expect(item).toMatchObject({
        displayName: 'Item',
        exportName: 'Item',
        props: {
          value: {
            parent: { name: 'ItemProps' },
            required: true,
            type: { name: 'string' },
          },
          disabled: {
            parent: { name: 'ItemProps' },
            required: false,
            type: { name: 'boolean | undefined' },
          },
        },
      });

      const itemTrigger = extract('ItemTrigger', componentSource);
      expect(itemTrigger).toMatchObject({
        displayName: 'ItemTrigger',
        exportName: 'ItemTrigger',
        props: {
          onClick: {
            parent: { name: 'ItemTriggerProps' },
            required: false,
            type: { name: '() => void' },
          },
        },
      });
    });
  });

  describe('as-cast with marker intersection (Primer)', () => {
    it('detects component after as WithSlotMarker cast', () => {
      const doc = extract(
        'default',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'Component',
        exportName: 'default',
        props: {
          checked: {
            description: 'Whether the checkbox is checked',
            parent: { name: 'CheckboxProps' },
            required: false,
            type: { name: 'boolean | undefined' },
          },
          onChange: {
            description: 'Change handler',
            parent: { name: 'CheckboxProps' },
            required: false,
            type: { name: '(checked: boolean) => void' },
          },
          disabled: {
            description: 'Disabled state',
            parent: { name: 'CheckboxProps' },
            required: false,
            type: { name: 'boolean | undefined' },
          },
        },
      });
    });
  });

  describe('as PolymorphicForwardRefComponent (Primer)', () => {
    it('detects component cast to polymorphic forwardRef interface', () => {
      const doc = extract(
        'Button',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'Button',
        exportName: 'Button',
        props: {
          variant: {
            description: 'Button variant style',
            parent: { name: 'ButtonProps' },
            required: false,
            type: {
              name: 'enum',
              value: [{ value: '"default"' }, { value: '"primary"' }, { value: '"danger"' }],
            },
          },
          size: {
            description: 'Button size',
            parent: { name: 'ButtonProps' },
            required: false,
            type: {
              name: 'enum',
              value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
            },
          },
        },
      });
    });

    it('extracts destructuring defaults from forwardRef with as-cast', () => {
      const doc = extract(
        'Stack',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'Stack',
        exportName: 'Stack',
        props: {
          direction: {
            description: 'Specify the direction',
            parent: { name: 'StackProps' },
            required: false,
            defaultValue: { value: "'vertical'" },
            type: {
              name: 'enum',
              value: [{ value: '"horizontal"' }, { value: '"vertical"' }],
            },
          },
          align: {
            description: 'Specify the alignment',
            parent: { name: 'StackProps' },
            required: false,
            defaultValue: { value: "'stretch'" },
            type: {
              name: 'enum',
              value: [
                { value: '"center"' },
                { value: '"end"' },
                { value: '"start"' },
                { value: '"stretch"' },
              ],
            },
          },
          wrap: {
            description: 'Specify wrapping',
            parent: { name: 'StackProps' },
            required: false,
            defaultValue: { value: "'nowrap'" },
            type: {
              name: 'enum',
              value: [{ value: '"wrap"' }, { value: '"nowrap"' }],
            },
          },
        },
      });
    });
  });

  describe('Object.assign compound component (Primer)', () => {
    it('detects component from Object.assign compound export', () => {
      const doc = extract(
        'default',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'FormControl',
        exportName: 'default',
        props: {
          id: {
            description: 'Unique identifier',
            parent: { name: 'FormControlProps' },
            required: true,
            type: { name: 'string' },
          },
          required: {
            description: 'Whether the field is required',
            parent: { name: 'FormControlProps' },
            required: false,
            type: { name: 'boolean | undefined' },
          },
          disabled: {
            description: 'Whether the field is disabled',
            parent: { name: 'FormControlProps' },
            required: false,
            type: { name: 'boolean | undefined' },
          },
        },
      });
    });

    it('extracts destructuring defaults through Object.assign', () => {
      const doc = extract(
        'Stack',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'Stack',
        exportName: 'Stack',
        props: {
          direction: {
            description: 'Specify the direction',
            parent: { name: 'StackProps' },
            required: false,
            defaultValue: { value: "'vertical'" },
            type: {
              name: 'enum',
              value: [{ value: '"horizontal"' }, { value: '"vertical"' }],
            },
          },
          align: {
            description: 'Specify the alignment',
            parent: { name: 'StackProps' },
            required: false,
            defaultValue: { value: "'stretch'" },
            type: {
              name: 'enum',
              value: [
                { value: '"stretch"' },
                { value: '"start"' },
                { value: '"center"' },
                { value: '"end"' },
              ],
            },
          },
          wrap: {
            description: 'Specify wrapping',
            parent: { name: 'StackProps' },
            required: false,
            defaultValue: { value: "'nowrap'" },
            type: {
              name: 'enum',
              value: [{ value: '"wrap"' }, { value: '"nowrap"' }],
            },
          },
        },
      });
    });
  });

  describe('aliased barrel re-export (Primer)', () => {
    it('detects component through aliased re-export', async () => {
      const entry = await extractFromStory(
        {
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
          'qa/barrel/index.stories.tsx': `
            import { Button } from './index';
            export default { component: Button };
          `,
        },
        'qa/barrel/index.stories.tsx'
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Button',
        exportName: 'Button',
        props: {
          label: {
            description: 'Button label',
            parent: { name: 'ButtonProps' },
            required: true,
            type: { name: 'string' },
          },
          variant: {
            description: 'Visual variant',
            parent: { name: 'ButtonProps' },
            required: false,
            type: {
              name: 'enum',
              value: [{ value: '"solid"' }, { value: '"outline"' }, { value: '"ghost"' }],
            },
          },
        },
      });
    });
  });

  describe('empty interface with deep extends (Mantine)', () => {
    it('extracts props from empty interface extending multiple bases', () => {
      const doc = extract(
        'TextInput',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'TextInput',
        exportName: 'TextInput',
        props: {
          className: {
            description: 'CSS class name',
            parent: { name: 'StylesApiProps' },
            required: false,
            type: { name: 'string' },
          },
          style: {
            description: 'Inline styles',
            parent: { name: 'StylesApiProps' },
            required: false,
          },
          label: {
            description: 'Input label',
            parent: { name: 'BaseInputProps' },
            required: false,
          },
          error: {
            description: 'Error message',
            parent: { name: 'BaseInputProps' },
            required: false,
          },
          description: {
            description: 'Description text',
            parent: { name: 'BaseInputProps' },
            required: false,
          },
          component: {
            description: 'Custom component',
            parent: { name: 'BoxProps' },
            required: false,
          },
        },
      });
    });
  });

  describe('factory() wrapping forwardRef internally (Mantine)', () => {
    it('detects component from factory HOC', () => {
      const doc = extract(
        'Select',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'Select',
        exportName: 'Select',
        props: {
          value: {
            description: 'Currently selected value',
            parent: { name: 'SelectProps' },
            required: false,
            type: { name: 'string' },
          },
          onChange: {
            description: 'Change handler',
            parent: { name: 'SelectProps' },
            required: false,
            type: { name: '(value: string | null) => void' },
          },
          data: {
            description: 'Dropdown options',
            parent: { name: 'SelectProps' },
            required: true,
            type: { name: 'string[]' },
          },
          searchable: {
            description: 'Whether the select is searchable',
            parent: { name: 'SelectProps' },
            required: false,
          },
        },
      });
    });
  });

  describe('standard Storybook fixtures', () => {
    it('extracts the standard Storybook Button fixture', () => {
      const doc = extract(
        'Button',
        `
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
      `
      );

      expect(doc).toMatchObject({
        description: 'Primary UI component for user interaction',
        displayName: 'Button',
        exportName: 'Button',
        jsDocTags: {
          import: ["import { Button } from '@design-system/components/override';"],
        },
        props: {
          primary: {
            description: 'Description of primary',
            parent: { name: 'ButtonProps' },
            required: false,
            defaultValue: { value: 'false' },
            type: { name: 'boolean | undefined' },
          },
          backgroundColor: {
            parent: { name: 'ButtonProps' },
            required: false,
            type: { name: 'string' },
          },
          size: {
            parent: { name: 'ButtonProps' },
            required: false,
            defaultValue: { value: "'medium'" },
            type: {
              name: 'enum',
              value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
            },
          },
          label: {
            parent: { name: 'ButtonProps' },
            required: true,
            type: { name: 'string' },
          },
          onClick: {
            parent: { name: 'ButtonProps' },
            required: false,
            type: { name: '() => void' },
          },
        },
      });
    });

    it('extracts a default-exported component', () => {
      const doc = extract(
        'default',
        `
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
      `
      );

      expect(doc).toMatchObject({
        displayName: 'Component',
        exportName: 'default',
        props: {
          user: {
            parent: { name: 'HeaderProps' },
            required: false,
            type: { name: 'User' },
          },
          onLogin: {
            parent: { name: 'HeaderProps' },
            required: false,
            type: { name: '() => void' },
          },
          onLogout: {
            parent: { name: 'HeaderProps' },
            required: false,
            type: { name: '() => void' },
          },
          onCreateAccount: {
            parent: { name: 'HeaderProps' },
            required: false,
            type: { name: '() => void' },
          },
        },
      });
    });
  });
});
