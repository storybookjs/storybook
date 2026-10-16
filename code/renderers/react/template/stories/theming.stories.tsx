import React, { createContext, useContext } from 'react';

import type { Meta, StoryObj } from '@storybook/react';
import { withThemeFromJSXProvider } from '@storybook/react';
import { ThemeProvider, convert, styled, themes, useTheme } from '@storybook/react/theming';

import { expect } from 'storybook/test';

const PaletteContext = createContext({ name: 'none', background: 'transparent' });

const PaletteProvider = ({
  theme,
  children,
}: {
  theme: { name: string; background: string };
  children: React.ReactNode;
}) => <PaletteContext.Provider value={theme}>{children}</PaletteContext.Provider>;

const Swatch = () => {
  const palette = useContext(PaletteContext);
  return (
    <p data-testid="swatch" style={{ background: palette.background, padding: 16 }}>
      {palette.name}
    </p>
  );
};

const Panel = styled.div(({ theme }) => ({
  background: theme.background.content,
  color: theme.color.defaultText,
  padding: 16,
}));

const ThemeName = () => {
  const theme = useTheme();
  return <Panel data-testid="panel">{theme.base}</Panel>;
};

const meta = {
  title: 'theming',
  parameters: {
    chromatic: { disableSnapshot: true },
    themes: { disable: false },
  },
} satisfies Meta;

export default meta;

export const WithThemeFromJSXProvider: StoryObj = {
  decorators: [
    withThemeFromJSXProvider({
      defaultTheme: 'b',
      themes: {
        a: { name: 'theme-a', background: 'white' },
        b: { name: 'theme-b', background: 'black' },
      },
      Provider: PaletteProvider,
    }),
  ],
  render: () => <Swatch />,
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('swatch')).toHaveTextContent('theme-b');
  },
};

export const StorybookThemeProvider: StoryObj = {
  decorators: [
    (Story) => (
      <ThemeProvider theme={convert(themes.dark)}>
        <Story />
      </ThemeProvider>
    ),
  ],
  render: () => <ThemeName />,
  play: async ({ canvas }) => {
    await expect(canvas.getByTestId('panel')).toHaveTextContent('dark');
  },
};
