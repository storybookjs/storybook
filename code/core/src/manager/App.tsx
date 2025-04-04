import type { ComponentProps } from 'react';
import React from 'react';

import type { Addon_PageType } from 'storybook/internal/types';

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
