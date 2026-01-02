import type { ComponentProps } from 'react';
import React, { useEffect } from 'react';

import Events from 'storybook/internal/core-events';
import type { Addon_PageType } from 'storybook/internal/types';

import { addons } from 'storybook/manager-api';
import { Global, createGlobal } from 'storybook/theming';

import { Layout } from './components/layout/Layout';
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
  /**
   * Lets us tell the UI whether or not keyboard shortcuts are enabled, in places where it's not
   * convenient to load the addons singleton to figure it out.
   */
  const { enableShortcuts = true } = addons.getConfig();
  useEffect(() => {
    document.body.setAttribute('data-shortcuts-enabled', enableShortcuts ? 'true' : 'false');
  }, [enableShortcuts]);

  /**
   * Detects when our component library has enabled a focus trap. By convention, react-aria sets the
   * document root to `inert` when a focus trap is enabled. We observe that attribute and inform the
   * preview iframe when to respect the focus trap, via a channel event. This is necessary because
   * inert is no longer propagated into iframes as per https://github.com/whatwg/html/issues/7605,
   * and the replacement permission policy is not yet widely available
   * (https://github.com/w3c/webappsec-permissions-policy/issues/273).
   */
  useEffect(() => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      return;
    }

    const observer = new MutationObserver(() => {
      const hasInert = rootElement.hasAttribute('inert');
      addons.getChannel().emit(Events.MANAGER_INERT_ATTRIBUTE_CHANGED, hasInert);
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
        slotSidebar={<Sidebar />}
        slotPanel={<Panel />}
        slotPages={pages.map(({ id, render: Content }) => (
          <Content key={id} />
        ))}
      />
    </>
  );
};
