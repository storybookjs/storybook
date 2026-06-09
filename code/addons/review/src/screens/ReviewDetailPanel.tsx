import React, {
  type Dispatch,
  type FC,
  type RefObject,
  type SetStateAction,
  useMemo,
  useState,
} from 'react';

import { styled } from 'storybook/theming';

import { useStorybookApi } from 'storybook/manager-api';

import { Drag } from '../../../../core/src/manager/components/layout/Drag.tsx';
import Panel from '../../../../core/src/manager/container/Panel.tsx';
import { MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX } from '../../../../core/src/manager/constants.ts';
import { useReviewPanelDrag } from './useReviewPanelDrag.ts';

const PanelSection = styled.div(({ theme }) => ({
  position: 'relative',
  flexShrink: 0,
  backgroundColor: theme.appContentBg,
  borderTop: `1px solid ${theme.appBorderColor}`,
}));

const PanelSlot = styled.div({
  height: '100%',
});

interface ReviewDetailPanelProps {
  storyId: string;
  isPanelShown: boolean;
  panelHeight: number;
  setPanelHeight: Dispatch<SetStateAction<number>>;
  hidePanel: () => void;
  previewFrameRef: RefObject<HTMLIFrameElement>;
}

export const ReviewDetailPanel: FC<ReviewDetailPanelProps> = ({
  storyId,
  isPanelShown,
  panelHeight,
  setPanelHeight,
  hidePanel,
  previewFrameRef,
}) => {
  const api = useStorybookApi();
  const [isDragging, setIsDragging] = useState(false);
  const { panelResizerRef, panelMaxSize } = useReviewPanelDrag({
    panelHeight,
    setPanelHeight,
    isDragging,
    setIsDragging,
    previewFrameRef,
  });

  const effectiveHeight = isPanelShown ? panelHeight : 0;
  const shouldHidePanelContent = effectiveHeight === 0;

  const panelActions = useMemo(
    () => ({
      onSelect: (panel: string) => api.setSelectedPanel(panel),
      toggleVisibility: () => hidePanel(),
    }),
    [api, hidePanel]
  );

  const sectionHeight = effectiveHeight > 0 ? effectiveHeight : MINIMUM_HORIZONTAL_PANEL_HEIGHT_PX;

  return (
    <PanelSection style={{ height: sectionHeight }}>
      <Drag
        ref={panelResizerRef}
        position="bottom"
        overlapping={!!effectiveHeight}
        aria-label="Addon panel resize handle"
        aria-valuenow={effectiveHeight}
        aria-valuemax={panelMaxSize}
      />
      <PanelSlot
        hidden={shouldHidePanelContent ? true : undefined}
        aria-hidden={shouldHidePanelContent ? true : undefined}
      >
        <Panel
          storyId={storyId}
          panelPosition="bottom"
          actions={panelActions}
          showPanelPositionToggle={false}
        />
      </PanelSlot>
    </PanelSection>
  );
};
