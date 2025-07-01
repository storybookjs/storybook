'use client';

import type { FC, PropsWithChildren } from 'react';

import initHeadManager from 'next/dist/client/head-manager';
// @ts-expect-error no types
import React, { useMemo } from 'next/dist/compiled/react';
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

const HeadManagerProvider: FC<PropsWithChildren> = ({ children }) => {
  const headManager: HeadManagerValue = useMemo(initHeadManager, []);
  headManager.getIsSsr = () => false;

  return <HeadManagerContext.Provider value={headManager}>{children}</HeadManagerContext.Provider>;
};

export default HeadManagerProvider;
