import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extract, extractFromStory } from './componentMetaExtractor.test-helpers.ts';

describe('real-world component patterns', () => {
  describe('ForwardRefExoticComponent from HOC factory (Park UI)', () => {
    it('extracts withProvider HOC', async () => {
      const entry = await extract(
        'Root',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Root',
        props: {
          items: { description: 'The accordion items', required: true, type: { name: 'string[]' } },
          multiple: { description: 'Whether multiple items can be open', required: false },
        },
      });
    });

    it('extracts withContext HOC', async () => {
      const entry = await extract(
        'ItemTrigger',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'ItemTrigger',
        props: {
          onClick: { description: 'Click handler', required: false, type: { name: '() => void' } },
        },
      });
    });

    it('extracts multiple HOC-wrapped sub-components', async () => {
      const componentSource = dedent`
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

      const root = await extract('Root', componentSource);
      expect(root.component?.reactComponentMeta).toMatchObject({
        displayName: 'Root',
        props: { multiple: { required: false } },
      });

      const item = await extract('Item', componentSource);
      expect(item.component?.reactComponentMeta).toMatchObject({
        displayName: 'Item',
        props: { value: { required: true }, disabled: { required: false } },
      });

      const itemTrigger = await extract('ItemTrigger', componentSource);
      expect(itemTrigger.component?.reactComponentMeta).toMatchObject({
        displayName: 'ItemTrigger',
        props: { onClick: { required: false } },
      });
    });
  });

  describe('as-cast patterns (Primer)', () => {
    it('extracts component after as WithSlotMarker cast', async () => {
      const entry = await extract(
        'default',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        exportName: 'default',
        props: {
          checked: { description: 'Whether the checkbox is checked', required: false },
          onChange: { description: 'Change handler', required: false },
          disabled: { description: 'Disabled state', required: false },
        },
      });
    });

    it('extracts PolymorphicForwardRefComponent', async () => {
      const entry = await extract(
        'Button',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Button',
        props: {
          variant: {
            description: 'Button variant style',
            type: {
              name: 'enum',
              value: [{ value: '"default"' }, { value: '"primary"' }, { value: '"danger"' }],
            },
          },
          size: {
            description: 'Button size',
            type: {
              name: 'enum',
              value: [{ value: '"small"' }, { value: '"medium"' }, { value: '"large"' }],
            },
          },
        },
      });
    });

    it('extracts destructuring defaults from PolymorphicForwardRefComponent', async () => {
      const entry = await extract(
        'Stack',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Stack',
        props: {
          direction: { defaultValue: { value: "'vertical'" } },
          align: { defaultValue: { value: "'stretch'" } },
          wrap: { defaultValue: { value: "'nowrap'" } },
        },
      });
    });
  });

  describe('Object.assign compound component (Primer)', () => {
    it('extracts component from Object.assign export', async () => {
      const entry = await extract(
        'default',
        dedent`
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

          const FormControl = Object.assign(FormControlBase, { Caption, Label });

          export default FormControl;
        `
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'FormControl',
        props: {
          id: { description: 'Unique identifier', required: true },
          required: { description: 'Whether the field is required', required: false },
          disabled: { description: 'Whether the field is disabled', required: false },
        },
      });
    });

    it('extracts destructuring defaults through Object.assign', async () => {
      const entry = await extract(
        'Stack',
        dedent`
          import React, { forwardRef, type ElementType } from 'react';

          interface StackProps {
            direction?: 'horizontal' | 'vertical';
            align?: 'stretch' | 'start' | 'center' | 'end';
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Stack',
        props: {
          direction: { defaultValue: { value: "'vertical'" } },
          align: { defaultValue: { value: "'stretch'" } },
          wrap: { defaultValue: { value: "'nowrap'" } },
        },
      });
    });
  });

  describe('aliased barrel re-export (Primer)', () => {
    it('extracts component through aliased re-export', async () => {
      const entry = await extractFromStory(
        {
          'qa/barrel/Button.tsx': dedent`
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
          'qa/barrel/index.stories.tsx': dedent`
            import { Button } from './index';
            export default { component: Button };
          `,
        },
        'qa/barrel/index.stories.tsx'
      );

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Button',
        props: {
          label: { description: 'Button label', required: true },
          variant: {
            description: 'Visual variant',
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
    it('extracts props from empty interface extending multiple bases', async () => {
      const entry = await extract(
        'TextInput',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'TextInput',
        props: {
          className: { description: 'CSS class name', parent: { name: 'StylesApiProps' } },
          label: { description: 'Input label', parent: { name: 'BaseInputProps' } },
          error: { description: 'Error message', parent: { name: 'BaseInputProps' } },
          description: { description: 'Description text', parent: { name: 'BaseInputProps' } },
          component: { description: 'Custom component', parent: { name: 'BoxProps' } },
        },
      });
    });
  });

  describe('factory() wrapping forwardRef (Mantine)', () => {
    it('extracts component from factory HOC', async () => {
      const entry = await extract(
        'Select',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Select',
        props: {
          value: { description: 'Currently selected value', required: false },
          onChange: { description: 'Change handler', required: false },
          data: { description: 'Dropdown options', required: true },
          searchable: { description: 'Whether the select is searchable', required: false },
        },
      });
    });
  });

  describe('standard Storybook fixtures', () => {
    it('extracts the standard Button fixture', async () => {
      const entry = await extract(
        'Button',
        dedent`
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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        description: 'Primary UI component for user interaction',
        displayName: 'Button',
        jsDocTags: { import: ["import { Button } from '@design-system/components/override';"] },
        props: {
          primary: { description: 'Description of primary', defaultValue: { value: 'false' } },
          size: { defaultValue: { value: "'medium'" } },
          label: { required: true },
          onClick: { required: false },
        },
      });
    });

    it('extracts default-exported Header fixture', async () => {
      const entry = await extract(
        'default',
        dedent`
          import React from 'react';

          interface User { name: string }

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

      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Component',
        exportName: 'default',
        props: {
          user: { parent: { name: 'HeaderProps' }, type: { name: 'User' } },
          onLogin: { required: false },
          onLogout: { required: false },
          onCreateAccount: { required: false },
        },
      });
    });
  });
});
