import { dedent } from 'ts-dedent';

export const fsMocks = {
  ['./package.json']: JSON.stringify({ name: 'some-package' }),
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
          /** Description of primary */
          primary?: boolean;
          backgroundColor?: string;
          size?: 'small' | 'medium' | 'large';
          label: string;
          onClick?: () => void;
        }
        
        /** 
         * Primary UI component for user interaction
         * @import import { Button } from '@design-system/components/Button';
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
        };`,
  ['./src/stories/Header.stories.ts']: dedent`
        import type { Meta, StoryObj } from '@storybook/react';
        import { fn } from 'storybook/test';
        import Header from './Header';
        
        /** 
          * Description from meta and very long.
          * @summary Component summary
          * @import import { Header } from '@design-system/components/Header';
          */
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
        
        /**
         * @import import { Header } from '@design-system/components/Header';
         */
        export default ({ user, onLogin, onLogout, onCreateAccount }: HeaderProps) => (
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
};
