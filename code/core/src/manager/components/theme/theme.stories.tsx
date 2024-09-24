import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { Theme } from './theme';

const meta = {
  component: Theme,
  title: 'Theme',
  argTypes: {
    accent: { control: 'color' },
    background: { control: 'color' },
    accentSidebar: { control: 'color' },
    backgroundSidebar: { control: 'color' },
    documentation: { control: 'color' },
    directory: { control: 'color' },
    component: { control: 'color' },
    story: { control: 'color' },
  },
  decorators: [
    (Story, { args }) => {
      const [forceReRenderKey, setForceReRenderKey] = React.useState(0);

      useEffect(() => {
        setForceReRenderKey((prev) => prev + 1);
      }, [args]);

      function generateCSSVariables() {
        const variables = {
          '--sb-accent': args.accent,
          '--sb-backgroundSidebar': args.backgroundSidebar,
          '--sb-background': args.background,
          '--sb-accentSidebar': args.accentSidebar,
          '--sb-documentation': args.documentation,
          '--sb-directory': args.directory,
          '--sb-component': args.component,
          '--sb-story': args.story,
        };

        return Object.entries(variables)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => `${key}: ${value};`)
          .join('\n');
      }

      return (
        <>
          <style>
            {`
              :root {
                ${generateCSSVariables()}
              }
            `}
          </style>
          <Story key={forceReRenderKey} />
        </>
      );
    },
  ],
} satisfies Meta<typeof Theme>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
