import React, { useRef, useState } from 'react';

import { Addon_TypesEnum, type Addon_BaseType } from 'storybook/internal/types';

import { expect, userEvent, within } from 'storybook/test';

import preview from '../../../../../.storybook/preview.tsx';
import { useLandmark } from '../../hooks/useLandmark.ts';
import { ToolbarComp } from './Toolbar.tsx';

/** Entry in react-aria's document-level landmark manager. */
interface RegisteredLandmark {
  /** The `aria-label` or `aria-labelledby` value. */
  label?: string;
  ref: { current: unknown };
}

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
    await expect(getLandmarks().map((l) => l.label)).toContain('sb-preview-toolbar-title');

    await userEvent.click(canvas.getByRole('button', { name: 'Hide toolbar' }));
    await expect(canvas.queryByTestId('sb-preview-toolbar')).not.toBeInTheDocument();
    await expect(getLandmarks().map((l) => l.label)).not.toContain('sb-preview-toolbar-title');

    await userEvent.click(canvas.getByRole('button', { name: 'Mount region' }));
    await expect(canvas.getByRole('region', { name: 'Extra region' })).toBeInTheDocument();
    await expect(getLandmarks().map((l) => l.label)).toContain('Extra region');
    await expect(getLandmarks().every((l) => l.ref.current instanceof Node)).toBe(true);
  },
});

function getLandmarks(): RegisteredLandmark[] {
  const managers = document as unknown as Record<symbol, { landmarks: RegisteredLandmark[] }>;
  return managers[Symbol.for('react-aria-landmark-manager')]?.landmarks ?? [];
}

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
