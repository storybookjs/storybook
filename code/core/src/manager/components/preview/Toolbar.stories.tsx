import React, { useRef, useState } from 'react';

import { Addon_TypesEnum, type Addon_BaseType } from 'storybook/internal/types';

import { expect, userEvent, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview.tsx';
import { useLandmark } from '../../hooks/useLandmark.ts';
import { ToolbarComp } from './Toolbar.tsx';

const TOOLS: Addon_BaseType[] = [
  {
    id: 'tool',
    title: 'tool',
    type: Addon_TypesEnum.TOOL,
    render: () => <button type="button">Tool</button>,
  },
];

const meta = preview.meta({
  component: ToolbarComp,
  args: { isShown: true, tools: TOOLS, toolsExtra: [] },
});

export default meta;

export const Default = meta.story({});

/** Hides the toolbar while it stays mounted, then mounts another landmark region. */
export const HiddenToolbarLeavesNoLandmark = meta.story({
  render: () => <HideThenMountRegion />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId('sb-preview-toolbar')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Hide toolbar' }));
    await expect(canvas.queryByTestId('sb-preview-toolbar')).not.toBeInTheDocument();

    // Mounting a landmark used to throw while the hidden toolbar's landmark was still registered.
    await userEvent.click(canvas.getByRole('button', { name: 'Mount region' }));
    await expect(canvas.getByRole('region', { name: 'Extra region' })).toBeInTheDocument();
  },
});

function HideThenMountRegion(): React.ReactElement {
  const [isShown, setIsShown] = useState(true);
  const [hasRegion, setHasRegion] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsShown(false)}>
        Hide toolbar
      </button>
      <button type="button" onClick={() => setHasRegion(true)}>
        Mount region
      </button>
      <ToolbarComp isShown={isShown} tools={TOOLS} toolsExtra={[]} />
      {hasRegion ? <ExtraRegion /> : null}
    </>
  );
}

function ExtraRegion(): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark({ role: 'region', 'aria-label': 'Extra region' }, ref);

  return (
    <section ref={ref} {...landmarkProps}>
      Extra region
    </section>
  );
}
