import type { FC, PropsWithChildren } from 'react';
import React, { useState } from 'react';

import { LocationProvider } from 'storybook/internal/router';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { startCase } from 'es-toolkit/string';
import { action } from 'storybook/actions';
import { ManagerContext } from 'storybook/manager-api';
import { expect, fn } from 'storybook/test';
import { styled } from 'storybook/theming';

import { isChromatic } from '../../../../../.storybook/isChromatic';
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

const PlaceholderClock: FC<{ id: string } & PropsWithChildren> = ({ children, id }) => {
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
      <button data-testid={id} className="sb-sr-only">
        Focusable
      </button>
      {children}
    </PlaceholderBlock>
  );
};

const MockSidebar: FC<any> = () => <PlaceholderClock id="sidebar" />;

const MockPreview: FC<any> = () => <PlaceholderClock id="preview" />;

const MockPanel: FC<any> = () => <PlaceholderClock id="panel" />;

const MockPage: FC<any> = () => <PlaceholderClock id="page" />;

const defaultState = {
  navSize: 150,
  bottomPanelHeight: 150,
  rightPanelWidth: 150,
  panelPosition: 'bottom',
  viewMode: 'story',
} as const;

const renderLabel = ({ name }: { name: string }) => startCase(name);

const mockManagerStore: any = {
  state: {
    index: {
      someRootId: {
        type: 'root',
        id: 'someRootId',
        name: 'root',
        renderLabel,
      },
      someComponentId: {
        type: 'component',
        id: 'someComponentId',
        name: 'component',
        parent: 'someRootId',
        renderLabel,
      },
      someStoryId: {
        type: 'story',
        subtype: 'story',
        id: 'someStoryId',
        name: 'story',
        parent: 'someComponentId',
        renderLabel,
      },
    },
  },
  api: {
    getCurrentStoryData: fn(() => {
      return mockManagerStore.state.index.someStoryId;
    }),
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
      <ManagerContext.Provider value={mockManagerStore}>
        <LocationProvider>
          <LayoutProvider>{storyFn()}</LayoutProvider>
        </LocationProvider>
      </ManagerContext.Provider>
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
  play: async ({ canvas, step }) => {
    await step('Verify preview can be focused', async () => {
      const preview = canvas.getByTestId('preview');
      preview.focus();
      expect(preview).toHaveFocus();
    });
    await step('Verify panel can be focused', async () => {
      const panel = canvas.getByTestId('panel');
      panel.focus();
      expect(panel).toHaveFocus();
    });
  },
};

export const DesktopCollapsedPanel: Story = {
  args: {
    managerLayoutState: { ...defaultState, bottomPanelHeight: 0 },
  },
  play: async ({ canvas, step }) => {
    await step('Verify panel is rendered but collapsed', async () => {
      const panel = canvas.getByTestId('panel');
      expect(panel.clientHeight).toBe(0);
    });

    await step('Verify panel cannot be focused', async () => {
      const panel = canvas.getByTestId('panel');
      panel.focus();
      expect(panel).not.toHaveFocus();
    });
  },
};

export const DesktopDocs: Story = {
  args: {
    managerLayoutState: { ...defaultState, viewMode: 'docs' },
  },
  play: async ({ canvas, step }) => {
    await step('Verify pages main landmark is not rendered', async () => {
      const pagesMain = canvas.queryByRole('main', { name: 'Main content' });
      expect(pagesMain).not.toBeInTheDocument();
    });
    await step('Verify preview area is  rendered', async () => {
      const preview = canvas.getByTestId('preview');
      expect(preview).toBeInTheDocument();
    });
  },
};

export const DesktopPages: Story = {
  args: {
    managerLayoutState: { ...defaultState, viewMode: 'settings' },
  },
  play: async ({ canvas, step }) => {
    await step('Verify pages main landmark is rendered', async () => {
      const pagesMain = canvas.queryByRole('main', { name: 'Main content' });
      expect(pagesMain).toBeInTheDocument();
      const page = canvas.getByTestId('page');
      page.focus();
      expect(page).toHaveFocus();
    });
    await step('Verify preview area is not rendered', async () => {
      const preview = canvas.queryByTestId('preview');
      expect(preview).not.toBeInTheDocument();
    });
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
