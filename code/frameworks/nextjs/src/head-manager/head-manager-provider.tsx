import type { PropsWithChildren } from 'react';
import React, { useMemo } from 'react';

import initHeadManager from 'next/dist/client/head-manager';
import { HeadManagerContext } from 'next/dist/shared/lib/head-manager-context.shared-runtime';

type HeadManagerValue = {
  updateHead?: ((state: JSX.Element[]) => void) | undefined;
  mountedInstances?: Set<unknown>;
  updateScripts?: ((state: any) => void) | undefined;
  scripts?: any;
  getIsSsr?: () => boolean;
  appDir?: boolean | undefined;
  nonce?: string | undefined;
};

const HeadManagerProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const headManager: HeadManagerValue = useMemo(initHeadManager, []);
  headManager.getIsSsr = () => false;

  return <HeadManagerContext.Provider value={headManager}>{children}</HeadManagerContext.Provider>;
};

export default HeadManagerProvider;
