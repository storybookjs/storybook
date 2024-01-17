import type { ComponentProps } from 'react';
import React from 'react';

import { Route } from '@storybook/router';

import type { ThemeVars } from '@storybook/theming';
import { Global, createGlobal } from '@storybook/theming';
import type { Addon_PageType } from '@storybook/types';
import { deprecate } from '@storybook/client-logger';
import Sidebar from './container/Sidebar';
import Preview from './container/Preview';
import Panel from './container/Panel';

import { Layout } from './components/layout/Layout';
import { useLayout } from './components/layout/LayoutProvider';
import { convertThemeV1intoV2, isThemeDifferentFromDefaultTheme } from './theme-v1-to-v2';

type Props = {
  managerLayoutState: ComponentProps<typeof Layout>['managerLayoutState'];
  setManagerLayoutState: ComponentProps<typeof Layout>['setManagerLayoutState'];
  pages: Addon_PageType[];
  theme: ThemeVars;
};

export const App = ({ managerLayoutState, setManagerLayoutState, pages, theme }: Props) => {
  const { setMobileAboutOpen } = useLayout();

  // This is to check if we are using the old theme format.
  // TODO: Remove this check when we stop supporting the old theming format.
  const isUsingLightThemeV1 = isThemeDifferentFromDefaultTheme('light', theme);
  const isUsingDarkThemeV1 = isThemeDifferentFromDefaultTheme('dark', theme);
  const isThemeV1 = isUsingLightThemeV1 || isUsingDarkThemeV1;
  if (isThemeV1)
    deprecate('Use of deprecated theme format detected. Please migrate to the new format.');

  return (
    <>
      <Global styles={createGlobal} />

      {/* Convert theme v1 into CSS variables */}
      {isThemeV1 && <Global styles={convertThemeV1intoV2(theme)} />}

      <Layout
        managerLayoutState={managerLayoutState}
        setManagerLayoutState={setManagerLayoutState}
        slotMain={
          <Route path={/(^\/story|docs|onboarding\/|^\/$)/} hideOnly>
            <Preview id="main" withLoader />
          </Route>
        }
        slotSidebar={<Sidebar onMenuClick={() => setMobileAboutOpen((state) => !state)} />}
        slotPanel={<Panel />}
        slotPages={pages.map(({ id, render: Content }) => (
          <Content key={id} />
        ))}
      />
    </>
  );
};
