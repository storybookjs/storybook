import React, { useRef, useState } from 'react';

import { Addon_TypesEnum, type Addon_BaseType } from 'storybook/internal/types';

import { expect, userEvent } from 'storybook/test';

import preview from '../../../../../.storybook/preview.tsx';
import { useLandmark } from '../../hooks/useLandmark.ts';
import { ToolbarComp, type ToolData } from './Toolbar.tsx';

// The toolbar is only shown when it has a tool to show.
const tool: Addon_BaseType = {
  id: 'test-tool',
  type: Addon_TypesEnum.TOOL,
  title: 'Test tool',
  render: () => <span>tool</span>,
};

/**
 * `@react-aria/landmark` keeps its registry on the document under this symbol. Each registered
 * landmark holds the ref of its element, so an entry with a null `ref.current` is a landmark whose
 * element has unmounted without being unregistered, which is what #36470 crashed on.
 */
const LANDMARK_MANAGER = Symbol.for('react-aria-landmark-manager');
type Landmark = { ref: { current: Element | null } };
const registeredLandmarks = (): Landmark[] =>
  (document as unknown as Record<symbol, { landmarks?: Landmark[] } | undefined>)[LANDMARK_MANAGER]
    ?.landmarks ?? [];

/** Stands in for the sidebar: another landmark that is shown after the toolbar was hidden. */
const Sidebar = () => {
  const ref = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark({ role: 'navigation', 'aria-label': 'Sidebar' }, ref);
  return (
    <nav ref={ref} data-testid="sidebar" {...landmarkProps}>
      Sidebar
    </nav>
  );
};

const meta = preview.meta({
  component: ToolbarComp,
  args: {
    isShown: true,
    tools: [tool],
    toolsExtra: [],
  },
  parameters: {
    layout: 'fullscreen',
  },
});

export const Shown = meta.story({
  play: async ({ canvas }) => {
    const toolbar = await canvas.findByTestId('sb-preview-toolbar');
    await expect(toolbar).toHaveAttribute('data-sb-landmark', 'true');
    await expect(registeredLandmarks().some((landmark) => landmark.ref.current === toolbar)).toBe(
      true
    );
  },
});

export const Hidden = meta.story({
  args: {
    isShown: false,
  },
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByTestId('sb-preview-toolbar')).not.toBeInTheDocument();
    // Nothing is registered for the hidden toolbar, so no entry points at a missing element.
    await expect(
      registeredLandmarks().filter((landmark) => landmark.ref.current === null)
    ).toHaveLength(0);
  },
});

/**
 * Reproduces #36470: the toolbar is shown, then hidden (for example by entering full screen), and
 * then another landmark mounts (for example the sidebar being shown again). Before the fix the
 * toolbar's landmark stayed registered with a null element, and `@react-aria/landmark` crashed
 * when it compared the new landmark's position against it.
 */
export const HiddenAfterShown = meta.story({
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  render: (args: ToolData) => {
    const [isShown, setIsShown] = useState(true);
    const [isSidebarShown, setIsSidebarShown] = useState(false);
    return (
      <>
        <ToolbarComp {...args} isShown={isShown} />
        <button type="button" onClick={() => setIsShown(false)}>
          Hide toolbar
        </button>
        <button type="button" onClick={() => setIsSidebarShown(true)}>
          Show sidebar
        </button>
        {isSidebarShown && <Sidebar />}
      </>
    );
  },
  play: async ({ canvas }) => {
    const toolbar = await canvas.findByTestId('sb-preview-toolbar');
    await expect(registeredLandmarks().some((landmark) => landmark.ref.current === toolbar)).toBe(
      true
    );

    await userEvent.click(await canvas.findByRole('button', { name: 'Hide toolbar' }));
    await expect(canvas.queryByTestId('sb-preview-toolbar')).not.toBeInTheDocument();
    // The toolbar's landmark is unregistered with it, not left behind with a null element.
    await expect(
      registeredLandmarks().filter((landmark) => landmark.ref.current === null)
    ).toHaveLength(0);

    await userEvent.click(await canvas.findByRole('button', { name: 'Show sidebar' }));
    const sidebar = await canvas.findByTestId('sidebar');
    await expect(sidebar).toHaveAttribute('data-sb-landmark', 'true');
    await expect(registeredLandmarks().some((landmark) => landmark.ref.current === sidebar)).toBe(
      true
    );
  },
});
