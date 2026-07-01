import type { FC, PropsWithChildren } from 'react';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { BREAKPOINT } from '../../constants.ts';
import { useMediaQuery } from '../../hooks/useMedia.tsx';

type LayoutContextType = {
  isMobileAboutOpen: boolean;
  setMobileAboutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobilePanelOpen: boolean;
  setMobilePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDesktop: boolean;
  isMobile: boolean;
};

const LayoutContext = createContext<LayoutContextType>({
  isMobileAboutOpen: false,
  setMobileAboutOpen: () => {},
  isMobilePanelOpen: false,
  setMobilePanelOpen: () => {},
  isDesktop: false,
  isMobile: false,
});

export const LayoutProvider: FC<
  PropsWithChildren & {
    forceDesktop?: boolean;
  }
> = ({ children, forceDesktop }) => {
  const [isMobileAboutOpen, setMobileAboutOpen] = useState(false);
  const [isMobilePanelOpen, setMobilePanelOpen] = useState(false);
  const isDesktop = forceDesktop ?? useMediaQuery(`(min-width: ${BREAKPOINT}px)`);
  const isMobile = !isDesktop;

  const contextValue = useMemo(
    () => ({
      isMobileAboutOpen,
      setMobileAboutOpen,
      isMobilePanelOpen,
      setMobilePanelOpen,
      isDesktop,
      isMobile,
    }),
    [isMobileAboutOpen, isMobilePanelOpen, isDesktop, isMobile]
  );
  return <LayoutContext.Provider value={contextValue}>{children}</LayoutContext.Provider>;
};

export const useLayout = () => useContext(LayoutContext);
