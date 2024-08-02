import { global as globalThis } from '@storybook/global';
import {
  withThemeByClassName,
  withThemeByDataAttribute,
  withThemeFromJSXProvider,
} from '@storybook/addon-themes';
import { useEffect } from 'storybook/internal/preview-api';

const cleanup = () => {
  const existing = globalThis.document.querySelector('style[data-theme-css]');
  if (existing) {
    existing.remove();
  }
};

const addStyleSheetDecorator = (storyFn: any) => {
  useEffect(() => {
    cleanup();

    const sheet = globalThis.document.createElement('style');
    sheet.setAttribute('data-theme-css', '');
    sheet.textContent = `
      [data-theme="theme-a"], .theme-a {
        background-color: white;
        color: black;
      }
      [data-theme="theme-b"], .theme-b {
        background-color: black;
        color: white;
      }
    `;

    globalThis.document.body.appendChild(sheet);

    return cleanup;
  });

  return storyFn();
};

export default {
  component: globalThis.Components.Pre,
  args: {
    text: 'Testing the themes',
  },
  globals: {
    sb_theme: 'light',
  },
  parameters: {
    chromatic: { disable: true },
    themes: { disable: false },
  },
  decorators: [addStyleSheetDecorator],
};

export const WithThemeByClassName = {
  globals: {},
  decorators: [
    withThemeByClassName({
      defaultTheme: 'a',
      themes: { a: 'theme-a', b: 'theme-b' },
      parentSelector: '#storybook-root > *',
    }),
  ],
};

export const WithThemeByDataAttribute = {
  globals: {},
  decorators: [
    withThemeByDataAttribute({
      defaultTheme: 'a',
      themes: { a: 'theme-a', b: 'theme-b' },
      parentSelector: '#storybook-root > *',
    }),
  ],
};

export const WithThemeFromJSXProvider = {
  globals: {},
  decorators: [
    withThemeFromJSXProvider({
      defaultTheme: 'a',
      themes: { a: { custom: 'theme-a' }, b: { custom: 'theme-b' } },
      Provider: ({ theme, children }: any) => {
        // this is not was a normal provider looks like obviously, but this needs to work in non-react as well
        // the timeout is to wait for the render to complete, as it's not possible to use the useEffect hook here
        setTimeout(() => {
          const element = globalThis.document.querySelector('#storybook-root > *');
          element?.classList.remove('theme-a', 'theme-b');
          element?.classList.add(theme.custom);
        }, 16);
        return children;
      },
    }),
  ],
};
