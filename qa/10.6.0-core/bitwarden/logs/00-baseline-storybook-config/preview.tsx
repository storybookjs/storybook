import { provideZoneChangeDetection } from '@angular/core';
import { setCompodocJson } from '@storybook/addon-docs/angular';
import { withThemeByClassName } from '@storybook/addon-themes';
import { applicationConfig, componentWrapperDecorator } from '@storybook/angular';
import type { Preview } from '@storybook/angular';

import {
  featureFlagDecorator,
  FEATURE_FLAG_CATALOG,
  FEATURE_FLAGS_GLOBAL,
  FEATURE_FLAGS_PARAM,
} from '@bitwarden/storybook';

import docJson from '../documentation.json';

setCompodocJson(docJson);

const wrapperDecorator = componentWrapperDecorator((story) => {
  return /*html*/ `
    <div class="tw-bg-bg-primary tw-px-5 tw-py-10 tw-@container">
      ${story}
    </div>
  `;
});

const preview: Preview = {
  decorators: [
    applicationConfig({
      providers: [provideZoneChangeDetection()],
    }),
    featureFlagDecorator,
    withThemeByClassName({
      themes: {
        light: 'theme_light',
        dark: 'theme_dark',
      },
      defaultTheme: 'light',
    }),
    wrapperDecorator,
  ],
  parameters: {
    a11y: {
      context: {
        include: ['#storybook-root', '.cdk-overlay-container'],
        exclude: ['.cdk-visually-hidden'],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    options: {
      storySort: {
        method: 'alphabetical',
        order: ['Documentation', ['Introduction', 'Colors', 'Icons'], 'Component Library'],
      },
    },
    docs: {
      source: {
        type: 'dynamic',
        excludeDecorators: true,
      },
    },
    backgrounds: {
      disabled: true,
    },
    // Published here (the preview can read the enum) so the manager's Feature
    // Flags panel can render the catalog without importing `@bitwarden/*`.
    // A parameter rather than a global: parameters are never diffed or written
    // to the URL, so this array survives the boundary intact.
    [FEATURE_FLAGS_PARAM]: { catalog: FEATURE_FLAG_CATALOG },
  },
  initialGlobals: {
    [FEATURE_FLAGS_GLOBAL]: [],
  },
  tags: ['autodocs'],
};

export default preview;
