import type { ComponentProps } from 'react';
import React, { useEffect } from 'react';

import type { Addon_PageType } from 'storybook/internal/types';

import { addons } from 'storybook/manager-api';
import { Global, createGlobal } from 'storybook/theming';

import { Layout } from './components/layout/Layout';
import { useLayout } from './components/layout/LayoutProvider';
import Panel from './container/Panel';
import Preview from './container/Preview';
import Sidebar from './container/Sidebar';

type Props = {
  managerLayoutState: ComponentProps<typeof Layout>['managerLayoutState'];
  setManagerLayoutState: ComponentProps<typeof Layout>['setManagerLayoutState'];
  pages: Addon_PageType[];
  hasTab: boolean;
};

export const App = ({ managerLayoutState, setManagerLayoutState, pages, hasTab }: Props) => {
  const { setMobileAboutOpen } = useLayout();

  const { enableShortcuts = true } = addons.getConfig();
  useEffect(() => {
    document.body.setAttribute('data-shortcuts-enabled', enableShortcuts ? 'true' : 'false');
  }, [enableShortcuts]);

  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'inert') {
          const hasInert = rootElement.hasAttribute('inert');
          addons.getChannel().emit('managerFocusTrapChange', hasInert);
        }
      });
    });

    observer.observe(rootElement, {
      attributes: true,
      attributeFilter: ['inert'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Global styles={createGlobal} />
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
