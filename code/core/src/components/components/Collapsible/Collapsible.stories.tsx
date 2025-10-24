import { useState } from 'react';

import preview from '../../../../../.storybook/preview';
import { Collapsible } from './Collapsible';

const toggle = ({
  isCollapsed,
  toggleCollapsed,
}: {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}) => <button onClick={toggleCollapsed}>{isCollapsed ? 'Open' : 'Close'}</button>;

const content = <div style={{ background: 'papayawhip', padding: 16 }}>Peekaboo!</div>;

const meta = preview.meta({
  component: Collapsible,
  args: {
    summary: toggle,
    children: content,
  },
});

export const Default = meta.story({});

export const Open = meta.story({
  play: ({ canvas, userEvent }) => userEvent.click(canvas.getByRole('button', { name: 'Open' })),
});

export const InitialOpen = meta.story({
  args: {
    initialCollapsed: false,
  },
});

export const Controlled = meta.story({
  render: () => {
    const [collapsed, setCollapsed] = useState(true);
    return (
      <>
        <button onClick={() => setCollapsed(!collapsed)}>Toggle</button>
        <Collapsible collapsed={collapsed}>{content}</Collapsible>
      </>
    );
  },
});
