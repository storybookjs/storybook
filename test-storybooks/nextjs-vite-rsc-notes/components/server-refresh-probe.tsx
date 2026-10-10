import { refresh } from "next/cache";

let count = 0;

export function resetServerRefreshProbe() {
  count = 0;
}

export function readServerRefreshProbe() {
  return count;
}

export function ServerRefreshProbe({ shouldRefresh }: { shouldRefresh: boolean }) {
  return (
    <form
      action={async () => {
        "use server";

        count += 1;
        if (shouldRefresh) {
          refresh();
        }
      }}
    >
      <p>server count: {count}</p>
      <button>Increment</button>
    </form>
  );
}
