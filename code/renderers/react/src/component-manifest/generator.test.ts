import { beforeEach, expect, test, vi } from 'vitest';

import { type StoryIndexGenerator } from 'storybook/internal/core-server';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { componentManifestGenerator } from './generator';

vi.mock('node:fs/promises');

// Use the provided indexJson from this file
const indexJson = {
  v: 5,
  entries: {
    'example-button--primary': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--primary',
      name: 'Primary',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Primary',
    },
    'example-button--secondary': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--secondary',
      name: 'Secondary',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Secondary',
    },
    'example-button--large': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--large',
      name: 'Large',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Large',
    },
    'example-button--small': {
      type: 'story',
      subtype: 'story',
      id: 'example-button--small',
      name: 'Small',
      title: 'Example/Button',
      importPath: './src/stories/Button.stories.ts',
      componentPath: './src/stories/Button.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'Small',
    },
    'example-header--docs': {
      id: 'example-header--docs',
      title: 'Example/Header',
      name: 'Docs',
      importPath: './src/stories/Header.stories.ts',
      type: 'docs',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      storiesImports: [],
    },
    'example-header--logged-in': {
      type: 'story',
      subtype: 'story',
      id: 'example-header--logged-in',
      name: 'Logged In',
      title: 'Example/Header',
      importPath: './src/stories/Header.stories.ts',
      componentPath: './src/stories/Header.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'LoggedIn',
    },
    'example-header--logged-out': {
      type: 'story',
      subtype: 'story',
      id: 'example-header--logged-out',
      name: 'Logged Out',
      title: 'Example/Header',
      importPath: './src/stories/Header.stories.ts',
      componentPath: './src/stories/Header.tsx',
      tags: ['dev', 'test', 'vitest', 'autodocs'],
      exportName: 'LoggedOut',
    },
  },
};

beforeEach(() => {
  vol.fromJSON({
    ['./src/stories/Button.stories.ts']: dedent`
        import type { Meta, StoryObj } from '@storybook/react';
        import { fn } from 'storybook/test';
        import { Button } from './Button';
        
        const meta = {
          component: Button,
          args: { onClick: fn() },
        } satisfies Meta<typeof Button>;
        export default meta;
        type Story = StoryObj<typeof meta>;
        
        export const Primary: Story = { args: { primary: true,  label: 'Button' } };
        export const Secondary: Story = { args: { label: 'Button' } };
        export const Large: Story = { args: { size: 'large', label: 'Button' } };
        export const Small: Story = { args: { size: 'small', label: 'Button' } };`,
    ['./src/stories/Button.tsx']: dedent`
        import React from 'react';
        export interface ButtonProps {
          primary?: boolean;
          backgroundColor?: string;
          size?: 'small' | 'medium' | 'large';
          label: string;
          onClick?: () => void;
        }
        
        /** Primary UI component for user interaction */
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
        };`,
    ['./src/stories/Header.stories.ts']: dedent`
        import type { Meta, StoryObj } from '@storybook/react';
        import { fn } from 'storybook/test';
        import { Header } from './Header';
        
        /** Meta description */
        const meta = {
          component: Header,
          args: {
            onLogin: fn(),
            onLogout: fn(),
            onCreateAccount: fn(),
          }
        } satisfies Meta<typeof Header>;
        export default meta;
        type Story = StoryObj<typeof meta>;
        export const LoggedIn: Story = { args: { user: { name: 'Jane Doe' } } };
        export const LoggedOut: Story = {};
        `,
    ['./src/stories/Header.tsx']: dedent`
        import { Button } from './Button';
        
        export interface HeaderProps {
          user?: User;
          onLogin?: () => void;
          onLogout?: () => void;
          onCreateAccount?: () => void;
        }
        
        export const Header = ({ user, onLogin, onLogout, onCreateAccount }: HeaderProps) => (
          <header>
            <div className="storybook-header">
              <div>
                {user ? (
                  <>
                    <span className="welcome">
                      Welcome, <b>{user.name}</b>!
                    </span>
                    <Button size="small" onClick={onLogout} label="Log out" />
                  </>
                ) : (
                  <>
                    <Button size="small" onClick={onLogin} label="Log in" />
                    <Button primary size="small" onClick={onCreateAccount} label="Sign up" />
                  </>
                )}
              </div>
            </div>
          </header>
      );`,
  });
  return () => vol.reset();
});

test('componentManifestGenerator generates correct id, name, description and examples ', async () => {
  const generator = await componentManifestGenerator();
  const manifest = await generator({
    getIndex: async () => indexJson,
  } as unknown as StoryIndexGenerator);

  expect(manifest).toMatchInlineSnapshot(`
    {
      "example-button": {
        "description": "Primary UI component for user interaction",
        "examples": [
          {
            "name": "Primary",
            "snippet": "const Primary = () => <Button onClick={fn()} primary label="Button"></Button>;",
          },
          {
            "name": "Secondary",
            "snippet": "const Secondary = () => <Button onClick={fn()} label="Button"></Button>;",
          },
          {
            "name": "Large",
            "snippet": "const Large = () => <Button onClick={fn()} size="large" label="Button"></Button>;",
          },
          {
            "name": "Small",
            "snippet": "const Small = () => <Button onClick={fn()} size="small" label="Button"></Button>;",
          },
        ],
        "id": "example-button",
        "name": "Button",
      },
      "example-header": {
        "description": "Meta description",
        "examples": [
          {
            "name": "LoggedIn",
            "snippet": "const LoggedIn = () => <Header
        onLogin={fn()}
        onLogout={fn()}
        onCreateAccount={fn()}
        user={{ name: 'Jane Doe' }}></Header>;",
          },
          {
            "name": "LoggedOut",
            "snippet": "const LoggedOut = () => <Header onLogin={fn()} onLogout={fn()} onCreateAccount={fn()}></Header>;",
          },
        ],
        "id": "example-header",
        "name": "Header",
      },
    }
  `);
});
