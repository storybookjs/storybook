import { describe, expect, it } from 'vitest';

import { extract, extractFromStory } from './componentMetaExtractor.test-helpers';

describe('component detection', () => {
  describe('function components', () => {
    it('detects arrow function component', async () => {
      await extract('Button', `
        import React from 'react';
        interface Props { label: string }
        export const Button = (props: Props) => <button>{props.label}</button>;
      `);
    });

    it('detects function declaration component', async () => {
      await extract('Button', `
        import React from 'react';
        export function Button(props: { label: string }) { return <button /> }
      `);
    });

    it('detects component returning null', async () => {
      await extract('Empty', `
        import React from 'react';
        export const Empty = (props: { show: boolean }) => props.show ? <div /> : null;
      `);
    });

    it('detects component with no props', async () => {
      await extract('Logo', `
        import React from 'react';
        export const Logo = () => <svg />;
      `);
    });
  });

  describe('class components', () => {
    it('detects class extending React.Component', async () => {
      await extract('Button', `
        import React from 'react';
        export class Button extends React.Component<{ label: string }> {
          render() { return <button /> }
        }
      `);
    });

    it('detects class extending React.PureComponent', async () => {
      await extract('Button', `
        import React from 'react';
        export class Button extends React.PureComponent<{ label: string }> {
          render() { return <button /> }
        }
      `);
    });
  });

  describe('wrapped components', () => {
    it('detects React.memo', async () => {
      await extract('Button', `
        import React from 'react';
        const Inner = (props: { label: string }) => <button />;
        export const Button = React.memo(Inner);
      `);
    });

    it('detects React.forwardRef', async () => {
      await extract('Button', `
        import React from 'react';
        export const Button = React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => (
          <button ref={ref} />
        ));
      `);
    });

    it('detects React.memo(React.forwardRef(...))', async () => {
      await extract('Button', `
        import React from 'react';
        export const Button = React.memo(
          React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => <button ref={ref} />)
        );
      `);
    });

    it('detects React.lazy', async () => {
      const entry = await extractFromStory(
        {
          'detect/lazy/Target.tsx': `
            import React from 'react';
            export default (props: {}) => <button />;
          `,
          'detect/lazy/Lazy.tsx': `
            import React from 'react';
            export const LazyButton = React.lazy(() => import('./Target'));
          `,
          'detect/lazy/Lazy.stories.tsx': `import { LazyButton } from './Lazy';\nexport default { component: LazyButton };`,
        },
        'detect/lazy/Lazy.stories.tsx'
      );
      expect(entry.component?.reactComponentMeta).toBeDefined();
    });
  });

  describe('default exports', () => {
    it('detects default exported component', async () => {
      await extract('default', `
        import React from 'react';
        const Button = (props: { label: string }) => <button />;
        export default Button;
      `);
    });

    it('detects inline default export', async () => {
      await extract('default', `
        import React from 'react';
        export default (props: { label: string }) => <button />;
      `);
    });

    it('detects default export function declaration', async () => {
      await extract('default', `
        import React from 'react';
        export default function Button(props: { label: string }) { return <button /> }
      `);
    });
  });

  describe('non-components', () => {
    it('rejects plain object', async () => {
      await expect(
        extract('Config', `export const Config = { key: 'value' };`, { ext: 'ts' })
      ).rejects.toThrow();
    });

    it('rejects string constant', async () => {
      await expect(
        extract('Title', `export const Title = 'Hello';`, { ext: 'ts' })
      ).rejects.toThrow();
    });

    it('rejects number constant', async () => {
      await expect(
        extract('Count', `export const Count = 42;`, { ext: 'ts' })
      ).rejects.toThrow();
    });

    it('rejects array', async () => {
      await expect(
        extract('Items', `export const Items = [1, 2, 3];`, { ext: 'ts' })
      ).rejects.toThrow();
    });

    it('rejects type-only exports', async () => {
      await expect(
        extract('ButtonProps', `
          export interface ButtonProps { label: string }
          export type Size = 'small' | 'large';
        `, { ext: 'ts' })
      ).rejects.toThrow();
    });

    it('rejects class not extending Component', async () => {
      await expect(
        extract('Store', `
          export class Store {
            data = {};
            get(key: string) { return this.data; }
          }
        `, { ext: 'ts' })
      ).rejects.toThrow();
    });
  });

  describe('ambiguous exports', () => {
    it('accepts uppercase function returning ReactNode-assignable value', async () => {
      await extract('FormatDate', `
        export function FormatDate(timestamp: number) { return new Date(timestamp).toISOString(); }
      `, { ext: 'ts' });
    });

    it('accepts function with primitive "props" param returning ReactNode', async () => {
      await extract('ParseProps', `
        export function ParseProps(props: string) { return JSON.parse(props); }
      `, { ext: 'ts' });
    });

    it('rejects enum-like const object', async () => {
      await expect(
        extract('ButtonVariant', `
          export const ButtonVariant = {
            Primary: 'primary',
            Secondary: 'secondary',
          } as const;
        `, { ext: 'ts' })
      ).rejects.toThrow();
    });
  });

  describe('multiple component exports', () => {
    it('detects multiple component exports from a single file', async () => {
      const content = `
        import React from 'react';
        interface ButtonProps { label: string }
        export const Button = (props: ButtonProps) => <button />;
        interface IconProps { name: string }
        export const Icon = (props: IconProps) => <span />;
      `;
      const button = await extract('Button', content);
      const icon = await extract('Icon', content);
      expect(button.displayName).toBe('Button');
      expect(icon.displayName).toBe('Icon');
    });
  });

  describe('mixed exports', () => {
    it('only detects components among mixed exports', async () => {
      const content = `
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
        export const Config = { key: 'value' };
        export const Icon = (props: { name: string }) => <span />;
        export const SIZES = ['small', 'large'] as const;
      `;
      await extract('Button', content);
      await expect(extract('Config', content)).rejects.toThrow();
      await extract('Icon', content);
      await expect(extract('SIZES', content)).rejects.toThrow();
    });

    it('detects components alongside type exports', async () => {
      await extract('Button', `
        import React from 'react';
        export interface ButtonProps { label: string }
        export const Button = (props: ButtonProps) => <button />;
        export type Size = 'small' | 'large';
      `);
    });
  });
});
