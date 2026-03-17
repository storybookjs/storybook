import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { extract, extractFromStory } from './componentMetaExtractor.test-helpers';

describe('component detection', () => {
  describe('function components', () => {
    it('detects arrow function component', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface Props { label: string }
          export const Button = (props: Props) => <button>{props.label}</button>;
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });

    it('detects function declaration component', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          export function Button(props: { label: string }) { return <button /> }
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });

    it('detects component returning null', async () => {
      const entry = await extract(
        'Empty',
        dedent`
          import React from 'react';
          export const Empty = (props: { show: boolean }) => props.show ? <div /> : null;
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Empty' });
    });

    it('detects component with no props', async () => {
      const entry = await extract(
        'Logo',
        dedent`
          import React from 'react';
          export const Logo = () => <svg />;
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Logo' });
    });

    it('detects function component with overloads', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface Props { label: string; size?: string }
          export function Button(props: Props): React.ReactElement;
          export function Button({ label, size = 'md' }: Props) {
            return <button />;
          }
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({
        displayName: 'Button',
        props: { label: { required: true }, size: { required: false } },
      });
    });
  });

  describe('class components', () => {
    it('detects class extending React.Component', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          export class Button extends React.Component<{ label: string }> {
            render() { return <button /> }
          }
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });

    it('detects class extending React.PureComponent', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          export class Button extends React.PureComponent<{ label: string }> {
            render() { return <button /> }
          }
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });
  });

  describe('wrapped components', () => {
    it('detects React.memo', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          const Inner = (props: { label: string }) => <button />;
          export const Button = React.memo(Inner);
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });

    it('detects React.forwardRef', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          export const Button = React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => (
            <button ref={ref} />
          ));
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });

    it('detects React.memo(React.forwardRef(...))', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          export const Button = React.memo(
            React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => <button ref={ref} />)
          );
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });

    it('detects React.lazy', async () => {
      const entry = await extractFromStory(
        {
          'detect/lazy/Target.tsx': dedent`
            import React from 'react';
            export default (props: {}) => <button />;
          `,
          'detect/lazy/Lazy.tsx': dedent`
            import React from 'react';
            export const LazyButton = React.lazy(() => import('./Target'));
          `,
          'detect/lazy/Lazy.stories.tsx': dedent`
            import { LazyButton } from './Lazy';
            export default { component: LazyButton };
          `,
        },
        'detect/lazy/Lazy.stories.tsx'
      );
      expect(entry.component?.reactComponentMeta).toBeDefined();
    });

    it('detects satisfies expression', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          interface Props { label: string }
          export const Button = ((props: Props) => <button />) satisfies React.FC<Props>;
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });
  });

  describe('default exports', () => {
    it('detects default exported component', async () => {
      const entry = await extract(
        'default',
        dedent`
          import React from 'react';
          const Button = (props: { label: string }) => <button />;
          export default Button;
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ exportName: 'default' });
    });

    it('detects inline default export', async () => {
      const entry = await extract(
        'default',
        dedent`
          import React from 'react';
          export default (props: { label: string }) => <button />;
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ exportName: 'default' });
    });

    it('detects default export function declaration', async () => {
      const entry = await extract(
        'default',
        dedent`
          import React from 'react';
          export default function Button(props: { label: string }) { return <button /> }
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ exportName: 'default' });
    });
  });

  describe('non-components', () => {
    it('rejects plain object', async () => {
      const entry = await extract('Config', `export const Config = { key: 'value' };`);
      expect(entry.component?.reactComponentMeta).toBeUndefined();
    });

    it('rejects string constant', async () => {
      const entry = await extract('Title', `export const Title = 'Hello';`);
      expect(entry.component?.reactComponentMeta).toBeUndefined();
    });

    it('rejects number constant', async () => {
      const entry = await extract('Count', `export const Count = 42;`);
      expect(entry.component?.reactComponentMeta).toBeUndefined();
    });

    it('rejects array', async () => {
      const entry = await extract('Items', `export const Items = [1, 2, 3];`);
      expect(entry.component?.reactComponentMeta).toBeUndefined();
    });

    it('rejects type-only exports', async () => {
      const entry = await extract(
        'ButtonProps',
        dedent`
          export interface ButtonProps { label: string }
          export type Size = 'small' | 'large';
        `
      );
      expect(entry.component?.reactComponentMeta).toBeUndefined();
    });

    it('rejects class not extending Component', async () => {
      const entry = await extract(
        'Store',
        dedent`
          export class Store {
            data = {};
            get(key: string) { return this.data; }
          }
        `
      );
      expect(entry.component?.reactComponentMeta).toBeUndefined();
    });

    it('rejects enum-like const object', async () => {
      const entry = await extract(
        'ButtonVariant',
        dedent`
          export const ButtonVariant = {
            Primary: 'primary',
            Secondary: 'secondary',
          } as const;
        `
      );
      expect(entry.component?.reactComponentMeta).toBeUndefined();
    });
  });

  describe('ambiguous exports', () => {
    it('accepts uppercase function returning ReactNode-assignable value', async () => {
      const entry = await extract(
        'FormatDate',
        dedent`
          export function FormatDate(timestamp: number) { return new Date(timestamp).toISOString(); }
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'FormatDate' });
    });

    it('accepts function with primitive props param', async () => {
      const entry = await extract(
        'ParseProps',
        dedent`
          export function ParseProps(props: string) { return JSON.parse(props); }
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'ParseProps' });
    });
  });

  describe('multiple and mixed exports', () => {
    it('detects multiple component exports from a single file', async () => {
      const content = dedent`
        import React from 'react';
        interface ButtonProps { label: string }
        export const Button = (props: ButtonProps) => <button />;
        interface IconProps { name: string }
        export const Icon = (props: IconProps) => <span />;
      `;
      const button = await extract('Button', content);
      const icon = await extract('Icon', content);
      expect(button.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
      expect(icon.component?.reactComponentMeta).toMatchObject({ displayName: 'Icon' });
    });

    it('only detects components among mixed exports', async () => {
      const content = dedent`
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
        export const Config = { key: 'value' };
        export const Icon = (props: { name: string }) => <span />;
        export const SIZES = ['small', 'large'] as const;
      `;
      const button = await extract('Button', content);
      expect(button.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
      const config = await extract('Config', content);
      expect(config.component?.reactComponentMeta).toBeUndefined();
      const icon = await extract('Icon', content);
      expect(icon.component?.reactComponentMeta).toMatchObject({ displayName: 'Icon' });
      const sizes = await extract('SIZES', content);
      expect(sizes.component?.reactComponentMeta).toBeUndefined();
    });

    it('detects components alongside type exports', async () => {
      const entry = await extract(
        'Button',
        dedent`
          import React from 'react';
          export interface ButtonProps { label: string }
          export const Button = (props: ButtonProps) => <button />;
          export type Size = 'small' | 'large';
        `
      );
      expect(entry.component?.reactComponentMeta).toMatchObject({ displayName: 'Button' });
    });
  });
});
