import * as React from 'react';
import type { JSXElementConstructor, ReactNode } from 'react';
import type { Container, RootOptions } from 'react-dom/client';

import * as ReactServer from '@vitejs/plugin-rsc/react/rsc';
import buildServerReferences from 'virtual:vite-rsc-browser-mode/build-server-references';
import loadClient from 'virtual:vite-rsc-browser-mode/load-client';

import type { FetchRsc, RscPayload, TestingLibraryClientRoot } from './react-client';

const mountedContainers = new Set<Container>();
const mountedRootEntries: {
  container: Container;
  root: TestingLibraryClientRoot;
}[] = [];

export async function renderServer(
  ui: ReactNode,
  {
    container,
    baseElement = document.body,
    wrapper: WrapperComponent,
  }: {
    container?: HTMLElement;
    baseElement?: HTMLElement;
    wrapper?: JSXElementConstructor<{ children: ReactNode }>;
    rerenderOnServerAction?: boolean;
  } = {}
): Promise<{
  container: HTMLElement;
  baseElement: HTMLElement;
  unmount: () => Promise<void>;
  rerender: (ui: ReactNode) => Promise<void>;
  asFragment: () => DocumentFragment;
}> {
  container ??= baseElement.appendChild(document.createElement('div'));

  const fetchRsc: FetchRsc = async (actionRequest) => {
    let returnValue: unknown | undefined;
    let temporaryReferences: unknown | undefined;
    if (actionRequest) {
      const { id, reply } = actionRequest;
      temporaryReferences = ReactServer.createTemporaryReferenceSet();
      const args = await ReactServer.decodeReply(reply, {
        temporaryReferences,
      });
      const action = await ReactServer.loadServerAction(id);
      returnValue = await action(...args);
    }
    let serverRoot = ui;
    if (WrapperComponent) {
      serverRoot = <WrapperComponent>{ui}</WrapperComponent>;
    }
    const rscPayload: RscPayload = {
      root: serverRoot,
      returnValue,
    };
    const rscOptions = { temporaryReferences };

    return ReactServer.renderToReadableStream<RscPayload>(rscPayload, rscOptions);
  };
  const root = await client.createTestingLibraryClientRoot({
    container,
    config,
    fetchRsc,
  });

  return {
    container,
    baseElement,
    unmount: root.unmount,
    rerender: async (newUi) => {
      ui = newUi;
      await root.rerender();
    },
    asFragment: () => {
      return document.createRange().createContextualFragment(container.innerHTML);
    },
  };
}

export async function cleanup() {
  for (const { root, container } of mountedRootEntries) {
    await root.unmount();
    if (container.parentNode === document.body) {
      document.body.removeChild(container);
    }
  }
  mountedRootEntries.length = 0;
  mountedContainers.clear();
}

export interface RenderConfiguration {
  reactStrictMode: boolean;
  rootOptions: RootOptions;
}

const config: RenderConfiguration = {
  reactStrictMode: false,
  rootOptions: {},
};

declare let __vite_rsc_raw_import__: (id: string) => Promise<unknown>;

const client = await loadClient();

export function initialize(customConfig: Partial<RenderConfiguration> = {}): void {
  Object.assign(config, customConfig);

  ReactServer.setRequireModule({
    load: (id) => {
      if (import.meta.env.__vite_rsc_build__) {
        const import_ = buildServerReferences[id];
        if (!import_) {
          throw new Error(`invalid server reference: ${id}`);
        }
        return import_();
      } else {
        return __vite_rsc_raw_import__(/* @vite-ignore */ id);
      }
    },
  });

  client.initialize();
}
