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

export const [page, setPage] = createMockedStore('page-ctx');
export const [navigating, setNavigating] = createMockedStore('navigating-ctx');
const [updated, setUpdated] = createMockedStore('updated-ctx');

(updated as any).check = () => {};

export { updated, setUpdated };

export function getStores() {
  return {
    page,
    navigating,
    updated,
  };
}
