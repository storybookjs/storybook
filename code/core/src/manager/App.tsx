import type { ComponentProps } from 'react';
import React from 'react';

import { Global, createGlobal } from '@storybook/core/theming';
import type { Addon_PageType } from '@storybook/core/types';
import type { ThemeVars } from '@storybook/theming';

import { deprecate } from '@storybook/core/client-logger';

import { Layout } from './components/layout/Layout';
import { useLayout } from './components/layout/LayoutProvider';
import Panel from './container/Panel';
import Preview from './container/Preview';
import Sidebar from './container/Sidebar';
import { checkThemeVersion, convertThemeV1intoV2 } from './utils/theme-v1-to-v2';

type Props = {
  managerLayoutState: ComponentProps<typeof Layout>['managerLayoutState'];
  setManagerLayoutState: ComponentProps<typeof Layout>['setManagerLayoutState'];
  pages: Addon_PageType[];
  hasTab: boolean;
  theme: ThemeVars;
};

export const App = ({ managerLayoutState, setManagerLayoutState, pages, theme, hasTab }: Props) => {
  const { setMobileAboutOpen } = useLayout();

  // This is to check if we are using the old theme format.
  // TODO: Remove this check when we stop supporting the old theming format.
  const themeVersion = checkThemeVersion(theme);

  if (themeVersion === 1) {
    deprecate('Use of deprecated theme format detected. Please migrate to the new format.');
  }

  console.log('themeVersion', themeVersion);

  return (
    <>
      <Global styles={createGlobal} />

      {/* Convert theme v1 into CSS variables */}
      {themeVersion === 1 && <Global styles={convertThemeV1intoV2(theme)} />}

      <Layout
        hasTab={hasTab}
        managerLayoutState={managerLayoutState}
        setManagerLayoutState={setManagerLayoutState}
        slotMain={<Preview id="main" withLoader />}
        slotSidebar={<Sidebar onMenuClick={() => setMobileAboutOpen((state) => !state)} />}
        slotPanel={<Panel />}
        slotPages={pages.map(({ id, render: Content }) => (
          <Content key={id} />
        ))}
      />
    </>
  );
};
