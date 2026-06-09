import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_BOTTOM_PANEL_HEIGHT } from '../../../../core/src/manager-api/modules/layout.ts';
import { PANEL_HEIGHT_SESSION_KEY, PANEL_VISIBLE_SESSION_KEY } from '../constants.ts';
import { sessionStore } from '../session-store.ts';

const readPanelVisible = (): boolean => {
  const stored = sessionStore.read(PANEL_VISIBLE_SESSION_KEY);
  return stored === null ? true : stored === 'true';
};

const readPanelHeight = (): number => {
  const stored = sessionStore.read(PANEL_HEIGHT_SESSION_KEY);
  if (!stored) {
    return DEFAULT_BOTTOM_PANEL_HEIGHT;
  }
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BOTTOM_PANEL_HEIGHT;
};

export const useReviewPanelState = () => {
  const [isPanelShown, setIsPanelShown] = useState(readPanelVisible);
  const [panelHeight, setPanelHeight] = useState(readPanelHeight);

  useEffect(() => {
    sessionStore.write(PANEL_VISIBLE_SESSION_KEY, String(isPanelShown));
  }, [isPanelShown]);

  useEffect(() => {
    sessionStore.write(PANEL_HEIGHT_SESSION_KEY, String(panelHeight));
  }, [panelHeight]);

  const togglePanel = useCallback((next?: boolean) => {
    setIsPanelShown((current) => (typeof next === 'boolean' ? next : !current));
  }, []);

  return {
    isPanelShown,
    panelHeight,
    setPanelHeight,
    togglePanel,
  };
};
