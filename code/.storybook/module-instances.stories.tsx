import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import * as managerApiPkg from '@storybook/manager/manager-api';
import * as channelsPkg from '@storybook/core/internal/channels';
import * as previewApiPkg from '@storybook/core/preview-api';
import * as testPkg from '@storybook/core/test';
import * as componentsPkg from '@storybook/ui/internal/components';
import * as themingPkg from '@storybook/ui/theming';
import * as themingCreatePkg from '@storybook/ui/theming/create';
import * as channels from 'storybook/internal/channels';
import * as components from 'storybook/internal/components';
import * as managerApi from 'storybook/manager-api';
import * as previewApi from 'storybook/preview-api';
import { expect } from 'storybook/test';
import * as test from 'storybook/test';
import * as theming from 'storybook/theming';
import * as themingCreate from 'storybook/theming/create';

import preview from './preview.tsx';

const meta = preview.meta({ title: 'internal/module-instances' });

export default meta;

/** Each module must exist once per realm, whichever package specifier imports it. */
export const OneInstancePerSpecifier = meta.story({
  render: () => <div>module instances</div>,
  play: async () => {
    await expect({
      theming: themingPkg.ThemeProvider === theming.ThemeProvider,
      emotion: theming.ThemeProvider === EmotionThemeProvider,
      themes: themingPkg.themes === theming.themes,
      convert: themingPkg.convert === theming.convert,
      themingCreate: themingCreatePkg.create === themingCreate.create,
      components: componentsPkg.Button === components.Button,
      previewApi: previewApiPkg.useArgs === previewApi.useArgs,
      channels: channelsPkg.Channel === channels.Channel,
      managerApi: managerApiPkg.addons === managerApi.addons,
      testExpect: testPkg.expect === test.expect,
      testFn: testPkg.fn === test.fn,
    }).toEqual({
      theming: true,
      emotion: true,
      themes: true,
      convert: true,
      themingCreate: true,
      components: true,
      previewApi: true,
      channels: true,
      managerApi: true,
      testExpect: true,
      testFn: true,
    });
  },
});
