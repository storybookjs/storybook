import type { FC, PropsWithChildren } from 'react';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { BREAKPOINT } from '../../constants';
import { useMediaQuery } from '../../hooks/useMedia';

type LayoutContextType = {
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileA11yStatementOpen: boolean;
  setMobileA11yStatementOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileAboutOpen: boolean;
  setMobileAboutOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobilePanelOpen: boolean;
  setMobilePanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDesktop: boolean;
  isMobile: boolean;
};

const LayoutContext = createContext<LayoutContextType>({
  isMobileMenuOpen: false,
  setMobileMenuOpen: () => {},
  isMobileA11yStatementOpen: false,
  setMobileA11yStatementOpen: () => {},
  isMobileAboutOpen: false,
  setMobileAboutOpen: () => {},
  isMobilePanelOpen: false,
  setMobilePanelOpen: () => {},
  isDesktop: false,
  isMobile: false,
});

export const LayoutProvider: FC<
  PropsWithChildren & {
    /* Helps with testing components that depend on LayoutProvider */
    forceDesktop?: boolean;
  }
> = ({ children, forceDesktop }) => {
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileA11yStatementOpen, setMobileA11yStatementOpen] = useState(false);
  const [isMobileAboutOpen, setMobileAboutOpen] = useState(false);
  const [isMobilePanelOpen, setMobilePanelOpen] = useState(false);
  const isDesktop = forceDesktop ?? useMediaQuery(`(min-width: ${BREAKPOINT}px)`);
  const isMobile = !isDesktop;

  const contextValue = useMemo(
    () => ({
      isMobileMenuOpen,
      setMobileMenuOpen,
      isMobileA11yStatementOpen,
      setMobileA11yStatementOpen,
      isMobileAboutOpen,
      setMobileAboutOpen,
      isMobilePanelOpen,
      setMobilePanelOpen,
      isDesktop,
      isMobile,
    }),
    [
      isMobileMenuOpen,
      setMobileMenuOpen,
      isMobileA11yStatementOpen,
      setMobileA11yStatementOpen,
      isMobileAboutOpen,
      setMobileAboutOpen,
      isMobilePanelOpen,
      setMobilePanelOpen,
      isDesktop,
      isMobile,
    ]
  );
  return <LayoutContext.Provider value={contextValue}>{children}</LayoutContext.Provider>;
};

export const useLayout = () => useContext(LayoutContext);
