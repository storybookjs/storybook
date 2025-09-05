import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';

import * as ReactClient from '@vitejs/plugin-rsc/react/browser';

import type { RenderConfiguration } from './testing-library';

export type RscPayload = {
  root: React.ReactNode;
  returnValue?: unknown;
};

export type TestingLibraryClientRoot = Awaited<ReturnType<typeof createTestingLibraryClientRoot>>;

export type FetchRsc = (actionRequest?: {
  id: string;
  reply: string | FormData;
}) => Promise<ReadableStream<Uint8Array>>;

export async function createTestingLibraryClientRoot(options: {
  container: HTMLElement;
  config: RenderConfiguration;
  fetchRsc: FetchRsc;
}) {
  let setPayload: (v: RscPayload) => void;

  const initialPayload = await ReactClient.createFromReadableStream<RscPayload>(
    await options.fetchRsc()
  );

  function BrowserRoot() {
    const [payload, setPayload_] = React.useState(initialPayload);

    React.useEffect(() => {
      setPayload = (v) => React.startTransition(() => setPayload_(v));
    }, [setPayload_]);

    return payload.root;
  }

  ReactClient.setServerCallback(async (id, args) => {
    const temporaryReferences = ReactClient.createTemporaryReferenceSet();
    const reply = await ReactClient.encodeReply(args, { temporaryReferences });
    const payload = await ReactClient.createFromReadableStream<RscPayload>(
      await options.fetchRsc({ id, reply }),
      { temporaryReferences }
    );
    setPayload(payload);
    return payload.returnValue;
  });

  let browserRoot = <BrowserRoot />;

  if (options.config.reactStrictMode) {
    browserRoot = <React.StrictMode>{browserRoot}</React.StrictMode>;
  }

  const reactRoot = ReactDOMClient.createRoot(options.container, options.config.rootOptions);
  reactRoot.render(browserRoot);

  async function rerender() {
    const payload = await ReactClient.createFromReadableStream<RscPayload>(
      await options.fetchRsc()
    );
    setPayload(payload);
  }

  function unmount() {
    reactRoot.unmount();
  }

  return {
    rerender: () => act(() => rerender()),
    unmount: () => act(() => unmount()),
  };
}

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// we call act only when rendering to flush any possible effects
// usually the async nature of Vitest browser mode ensures consistency,
// but rendering is sync and controlled by React directly
async function act<T>(callback: () => T | Promise<T>) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await React.act(callback);
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  }
}

export function initialize() {
  ReactClient.setRequireModule({
    load: (id) => import(/* @vite-ignore */ id),
  });
}
