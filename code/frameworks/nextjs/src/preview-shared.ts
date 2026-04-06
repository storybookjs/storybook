import { isNextRouterError } from 'next/dist/client/components/is-next-router-error.js';

export function addNextHeadCount() {
  const meta = document.createElement('meta');
  meta.name = 'next-head-count';
  meta.content = '0';
  document.head.appendChild(meta);
}

export function isAsyncClientComponentError(error: unknown) {
  return (
    typeof error === 'string' &&
    (error.includes('Only Server Components can be async at the moment.') ||
      error.includes('A component was suspended by an uncached promise.') ||
      error.includes('async/await is not yet supported in Client Components'))
  );
}

export function setupNextErrorPatching() {
  addNextHeadCount();

  // Copying Next patch of console.error:
  // https://github.com/vercel/next.js/blob/a74deb63e310df473583ab6f7c1783bc609ca236/packages/next/src/client/app-index.tsx#L15
  const origConsoleError = globalThis.console.error;
  globalThis.console.error = (...args: unknown[]) => {
    const error = args[0];
    if (isNextRouterError(error) || isAsyncClientComponentError(error)) {
      return;
    }
    origConsoleError.apply(globalThis.console, args);
  };

  globalThis.addEventListener('error', (ev: WindowEventMap['error']): void => {
    if (isNextRouterError(ev.error) || isAsyncClientComponentError(ev.error)) {
      ev.preventDefault();
      return;
    }
  });
}

export const parameters = {
  docs: {
    source: {
      excludeDecorators: true,
    },
  },
  react: {
    rootOptions: {
      onCaughtError(error: unknown) {
        if (isNextRouterError(error)) {
          return;
        }
        console.error(error);
      },
    },
  },
};
