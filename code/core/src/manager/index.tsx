import { global } from '@storybook/global';
import type { ComponentProps, FC } from 'react';
import { createRoot } from 'react-dom/client';
import React, { useCallback, useMemo } from 'react';

import { Location, LocationProvider, useNavigate } from '@storybook/core/router';
import { Provider as ManagerProvider, types } from '@storybook/core/manager-api';
import type { Combo } from '@storybook/core/manager-api';
import { ThemeProvider, ensure as ensureTheme } from '@storybook/core/theming';
import { ProviderDoesNotExtendBaseProviderError } from '@storybook/core/manager-errors';

import { HelmetProvider } from 'react-helmet-async';

import type { Addon_PageType } from '@storybook/core/types';
import { App } from './App';

import Provider from './provider';
import { settingsPageAddon } from './settings/index';
import { LayoutProvider } from './components/layout/LayoutProvider';
import type { Layout } from './components/layout/Layout';

// @ts-expect-error (Converted from ts-ignore)
ThemeProvider.displayName = 'ThemeProvider';
// @ts-expect-error (Converted from ts-ignore)
HelmetProvider.displayName = 'HelmetProvider';

export interface RootProps {
  provider: Provider;
  history?: History;
}

export const Root: FC<RootProps> = ({ provider }) => (
  <HelmetProvider key="helmet.Provider">
    <LocationProvider key="location.provider">
      <Main provider={provider} />
    </LocationProvider>
  </HelmetProvider>
);

const Main: FC<{ provider: Provider }> = ({ provider }) => {
  const navigate = useNavigate();

  return (
    <Location key="location.consumer">
      {(locationData) => (
        <ManagerProvider
          key="manager"
          provider={provider}
          {...locationData}
          navigate={navigate}
          docsOptions={global?.DOCS_OPTIONS || {}}
        >
          {(combo: Combo) => {
            const { state, api } = combo;
            const setManagerLayoutState = useCallback<
              ComponentProps<typeof Layout>['setManagerLayoutState']
            >(
              (sizes) => {
                api.setSizes(sizes);
              },
              [api]
            );

            const pages: Addon_PageType[] = useMemo(
              () => [settingsPageAddon, ...Object.values(api.getElements(types.experimental_PAGE))],
              [Object.keys(api.getElements(types.experimental_PAGE)).join()]
            );

            return (
              <ThemeProvider key="theme.provider" theme={ensureTheme(state.theme)}>
                <LayoutProvider>
                  <App
                    key="app"
                    pages={pages}
                    managerLayoutState={{
                      ...state.layout,
                      viewMode: state.viewMode,
                    }}
                    hasTab={!!api.getQueryParam('tab')}
                    setManagerLayoutState={setManagerLayoutState}
                  />
                </LayoutProvider>
              </ThemeProvider>
            );
          }}
        </ManagerProvider>
      )}
    </Location>
  );
};

export function renderStorybookUI(domNode: HTMLElement, provider: Provider) {
  if (!(provider instanceof Provider)) {
    throw new ProviderDoesNotExtendBaseProviderError();
  }

  const root = createRoot(domNode);
  root.render(<Root key="root" provider={provider} />);
}

export { Provider };
