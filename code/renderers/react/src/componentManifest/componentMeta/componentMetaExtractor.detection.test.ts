import { describe, expect, it } from 'vitest';

import type { StoryRef } from '../getComponentImports';
import { extract, withProject } from './componentMetaExtractor.test-helpers';

describe('component detection', () => {
  describe('function components', () => {
    it('detects arrow function component', () => {
      extract(
        'Button',
        `
        import React from 'react';
        interface Props { label: string }
        export const Button = (props: Props) => <button>{props.label}</button>;
      `
      );
    });

    it('detects function declaration component', () => {
      extract(
        'Button',
        `
        import React from 'react';
        export function Button(props: { label: string }) { return <button /> }
      `
      );
    });

    it('detects component returning null', () => {
      extract(
        'Empty',
        `
        import React from 'react';
        export const Empty = (props: { show: boolean }) => props.show ? <div /> : null;
      `
      );
    });

    it('detects component with no props', () => {
      extract(
        'Logo',
        `
        import React from 'react';
        export const Logo = () => <svg />;
      `
      );
    });
  });

  describe('class components', () => {
    it('detects class extending React.Component', () => {
      extract(
        'Button',
        `
        import React from 'react';
        export class Button extends React.Component<{ label: string }> {
          render() { return <button /> }
        }
      `
      );
    });

    it('detects class extending React.PureComponent', () => {
      extract(
        'Button',
        `
        import React from 'react';
        export class Button extends React.PureComponent<{ label: string }> {
          render() { return <button /> }
        }
      `
      );
    });
  });

  describe('wrapped components', () => {
    it('detects React.memo', () => {
      extract(
        'Button',
        `
        import React from 'react';
        const Inner = (props: { label: string }) => <button />;
        export const Button = React.memo(Inner);
      `
      );
    });

    it('detects React.forwardRef', () => {
      extract(
        'Button',
        `
        import React from 'react';
        export const Button = React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => (
          <button ref={ref} />
        ));
      `
      );
    });

    it('detects React.memo(React.forwardRef(...))', () => {
      extract(
        'Button',
        `
        import React from 'react';
        export const Button = React.memo(
          React.forwardRef<HTMLButtonElement, { label: string }>((props, ref) => <button ref={ref} />)
        );
      `
      );
    });

    it('detects React.lazy', () => {
      const doc = withProject(
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
        (project, paths) => {
          const entries: StoryRef[] = [
            {
              storyPath: paths['detect/lazy/Lazy.stories.tsx'],
              component: {
                componentName: 'LazyButton',
                importName: 'LazyButton',
                isPackage: false,
                path: paths['detect/lazy/Lazy.tsx'],
              },
            },
          ];
          project.extractPropsFromStories(entries);
          return entries[0].component?.reactComponentMeta;
        }
      );
      expect(doc).toBeDefined();
    });
  });

  describe('default exports', () => {
    it('detects default exported component', () => {
      extract(
        'default',
        `
        import React from 'react';
        const Button = (props: { label: string }) => <button />;
        export default Button;
      `
      );
    });

    it('detects inline default export', () => {
      extract(
        'default',
        `
        import React from 'react';
        export default (props: { label: string }) => <button />;
      `
      );
    });

    it('detects default export function declaration', () => {
      extract(
        'default',
        `
        import React from 'react';
        export default function Button(props: { label: string }) { return <button /> }
      `
      );
    });
  });

  describe('non-components', () => {
    it('rejects plain object', () => {
      expect(() =>
        extract('Config', `export const Config = { key: 'value' };`, { ext: 'ts' })
      ).toThrow();
    });

    it('rejects string constant', () => {
      expect(() => extract('Title', `export const Title = 'Hello';`, { ext: 'ts' })).toThrow();
    });

    it('rejects number constant', () => {
      expect(() => extract('Count', `export const Count = 42;`, { ext: 'ts' })).toThrow();
    });

    it('rejects array', () => {
      expect(() => extract('Items', `export const Items = [1, 2, 3];`, { ext: 'ts' })).toThrow();
    });

    it('rejects type-only exports', () => {
      expect(() =>
        extract(
          'ButtonProps',
          `
          export interface ButtonProps { label: string }
          export type Size = 'small' | 'large';
        `,
          { ext: 'ts' }
        )
      ).toThrow();
    });

    it('rejects class not extending Component', () => {
      expect(() =>
        extract(
          'Store',
          `
          export class Store {
            data = {};
            get(key: string) { return this.data; }
          }
        `,
          { ext: 'ts' }
        )
      ).toThrow();
    });
  });

  describe('ambiguous exports', () => {
    it('accepts uppercase function returning ReactNode-assignable value', () => {
      extract(
        'FormatDate',
        `
        export function FormatDate(timestamp: number) { return new Date(timestamp).toISOString(); }
      `,
        { ext: 'ts' }
      );
    });

    it('accepts function with primitive "props" param returning ReactNode', () => {
      extract(
        'ParseProps',
        `
        export function ParseProps(props: string) { return JSON.parse(props); }
      `,
        { ext: 'ts' }
      );
    });

    it('rejects enum-like const object', () => {
      expect(() =>
        extract(
          'ButtonVariant',
          `
          export const ButtonVariant = {
            Primary: 'primary',
            Secondary: 'secondary',
          } as const;
        `,
          { ext: 'ts' }
        )
      ).toThrow();
    });
  });

  describe('multiple component exports', () => {
    it('detects multiple component exports from a single file', () => {
      const content = `
        import React from 'react';
        interface ButtonProps { label: string }
        export const Button = (props: ButtonProps) => <button />;
        interface IconProps { name: string }
        export const Icon = (props: IconProps) => <span />;
      `;
      const button = extract('Button', content);
      const icon = extract('Icon', content);
      expect(button.displayName).toBe('Button');
      expect(icon.displayName).toBe('Icon');
    });
  });

  describe('mixed exports', () => {
    it('only detects components among mixed exports', () => {
      const content = `
        import React from 'react';
        export const Button = (props: { label: string }) => <button />;
        export const Config = { key: 'value' };
        export const Icon = (props: { name: string }) => <span />;
        export const SIZES = ['small', 'large'] as const;
      `;
      extract('Button', content);
      expect(() => extract('Config', content)).toThrow();
      extract('Icon', content);
      expect(() => extract('SIZES', content)).toThrow();
    });

    it('detects components alongside type exports', () => {
      extract(
        'Button',
        `
        import React from 'react';
        export interface ButtonProps { label: string }
        export const Button = (props: ButtonProps) => <button />;
        export type Size = 'small' | 'large';
      `
      );
    });
  });
});
