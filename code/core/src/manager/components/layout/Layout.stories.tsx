import type { FC, PropsWithChildren } from 'react';
import React, { useState } from 'react';

import { ManagerContext } from 'storybook/internal/manager-api';
import { LocationProvider } from 'storybook/internal/router';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';
import { fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import { isChromatic } from '../../../../../.storybook/isChromatic';
import MobileNavigationStoriesMeta from '../mobile/navigation/MobileNavigation.stories';
import { Layout } from './Layout';
import { LayoutProvider } from './LayoutProvider';

const PlaceholderBlock = styled.div({
  width: '100%',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
});

const PlaceholderClock: FC<PropsWithChildren> = ({ children }) => {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    if (isChromatic()) {
      return;
    }
    const interval = setInterval(() => {
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [count]);
  return (
    <PlaceholderBlock>
      <h2 data-chromatic="ignore">{count}</h2>
      {children}
    </PlaceholderBlock>
  );
};

const MockSidebar: FC<any> = () => <PlaceholderClock />;

const MockPreview: FC<any> = () => <PlaceholderClock />;

const MockPanel: FC<any> = () => <PlaceholderClock />;

const MockPage: FC<any> = () => <PlaceholderClock />;

const defaultState = {
  navSize: 150,
  bottomPanelHeight: 150,
  rightPanelWidth: 150,
  panelPosition: 'bottom',
  viewMode: 'story',
} as const;

const managerContext: any = {
  state: {},
  api: {
    foo: 'bar',
    getNavSizeWithCustomisations: fn()
      .mockName('api::getNavSizeWithCustomisations')
      .mockImplementation((size: number) => size),
  },
};

const meta = {
  title: 'Layout',
  component: Layout,
  args: {
    managerLayoutState: defaultState,
    slotMain: <MockPreview />,
    slotSidebar: <MockSidebar />,
    slotPanel: <MockPanel />,
    slotPages: <MockPage />,
    setManagerLayoutState: fn(),
    hasTab: false,
  },
  globals: { sb_theme: 'light' },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (storyFn) => (
      <ManagerContext.Provider value={managerContext}>{storyFn()}</ManagerContext.Provider>
    ),
    MobileNavigationStoriesMeta.decorators[0] as any,
    (storyFn) => (
      <LocationProvider>
        <LayoutProvider>{storyFn()}</LayoutProvider>
      </LocationProvider>
    ),
  ],
  render: (args) => {
    const [managerLayoutState, setManagerLayoutState] = useState(args.managerLayoutState);

    return (
      <Layout
        {...args}
        managerLayoutState={managerLayoutState}
        setManagerLayoutState={(nextPartialState) => {
          setManagerLayoutState({ ...managerLayoutState, ...nextPartialState });
          action('setManagerStoreState')(nextPartialState);
        }}
      />
    );
  },
} satisfies Meta<typeof Layout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};
export const Dark: Story = {
  globals: { sb_theme: 'dark' },
};
export const DesktopHorizontal: Story = {
  args: {
    managerLayoutState: { ...defaultState, panelPosition: 'right' },
  },
};

export const DesktopDocs: Story = {
  args: {
    managerLayoutState: { ...defaultState, viewMode: 'docs' },
  },
};

export const DesktopPages: Story = {
  args: {
    managerLayoutState: { ...defaultState, viewMode: 'settings' },
  },
};

export const Mobile = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    chromatic: { viewports: [320] },
  },
};
export const MobileDark = {
  ...Mobile,
  globals: { sb_theme: 'dark' },
};

export const MobileDocs = {
  ...Mobile,
  args: {
    managerLayoutState: { ...defaultState, viewMode: 'docs' },
  },
};
