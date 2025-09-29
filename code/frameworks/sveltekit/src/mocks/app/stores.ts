import { getContext, setContext } from 'svelte';

function createMockedStore(contextName: string) {
  return [
    {
      subscribe(runner: any) {
        const page = getContext(contextName);
        runner(page);
        return () => {};
      },
    },
    (value: unknown) => {
      setContext(contextName, value);
    },
  ] as const;
}

export const [page, setAppStoresPage] = createMockedStore('page-ctx');
export const [navigating, setAppStoresNavigating] = createMockedStore('navigating-ctx');
const [updated, setAppStoresUpdated] = createMockedStore('updated-ctx');

(updated as any).check = () => {};

export { updated, setAppStoresUpdated };

export function getStores() {
  return {
    page,
    navigating,
    updated,
  };
}
