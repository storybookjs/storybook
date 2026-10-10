import { refresh, revalidatePath, revalidateTag, unstable_cache, updateTag } from "next/cache";
import {
  nextCacheProbeFetchUrl,
  nextCacheProbeNoStoreFetchUrl,
  resetNextCacheProbeFetch,
} from "./next-cache-msw.ts";

const dataTag = "next-cache-probe:data";
const fetchTag = "next-cache-probe:fetch";

let dataVersion = 0;
let renderVersion = 0;
let actionWriteVersion = 0;
let cacheLabel = "default";

const readCachedData = unstable_cache(
  async () => {
    dataVersion += 1;
    return `${cacheLabel} data ${dataVersion}`;
  },
  ["next-cache-probe-data"],
  { tags: [dataTag] },
);

export function resetNextCacheProbe(label = "default") {
  dataVersion = 0;
  renderVersion = 0;
  actionWriteVersion = 0;
  cacheLabel = label;
  resetNextCacheProbeFetch(label);
}

export async function NextCacheProbe() {
  renderVersion += 1;
  const [cachedData, cachedFetch, cachedFetchDuplicate] = await Promise.all([
    readCachedData(),
    fetch(nextCacheProbeFetchUrl, {
      cache: "force-cache",
      next: { tags: [fetchTag] },
    }).then((response) => response.text()),
    fetch(nextCacheProbeFetchUrl, {
      cache: "force-cache",
      next: { tags: [fetchTag] },
    }).then((response) => response.text()),
  ]);
  const noStoreFetch = await fetch(nextCacheProbeNoStoreFetchUrl, { cache: "no-store" }).then(
    (response) => response.text(),
  );
  const noStoreFetchDuplicate = await fetch(nextCacheProbeNoStoreFetchUrl, {
    cache: "no-store",
  }).then((response) => response.text());

  return (
    <section>
      <p>render: {renderVersion}</p>
      <p>action writes: {actionWriteVersion}</p>
      <p>cached data: {cachedData}</p>
      <p>cached fetch: {cachedFetch}</p>
      <p>cached fetch duplicate: {cachedFetchDuplicate}</p>
      <p>no-store fetch: {noStoreFetch}</p>
      <p>no-store fetch duplicate: {noStoreFetchDuplicate}</p>
      <form
        action={async () => {
          "use server";
          actionWriteVersion += 1;
        }}
      >
        <button>Write without refresh</button>
      </form>
      <form
        action={async () => {
          "use server";
          actionWriteVersion += 1;
          refresh();
        }}
      >
        <button>Write and refresh</button>
      </form>
      <form
        action={async () => {
          "use server";
          refresh();
        }}
      >
        <button>Refresh</button>
      </form>
      <form
        action={async () => {
          "use server";
          updateTag(dataTag);
        }}
      >
        <button>Update data tag</button>
      </form>
      <form
        action={async () => {
          "use server";
          updateTag(fetchTag);
        }}
      >
        <button>Update fetch tag</button>
      </form>
      <form
        action={async () => {
          "use server";
          revalidateTag(dataTag, "max");
        }}
      >
        <button>Revalidate data tag</button>
      </form>
      <form
        action={async () => {
          "use server";
          revalidateTag(dataTag, { expire: 0 });
        }}
      >
        <button>Expire data tag</button>
      </form>
      <form
        action={async () => {
          "use server";
          actionWriteVersion += 1;
          revalidatePath("/", "page");
        }}
      >
        <button>Revalidate current path</button>
      </form>
      <form
        action={async () => {
          "use server";
          updateTag(dataTag);
          updateTag(fetchTag);
        }}
      >
        <button>Update both tags</button>
      </form>
    </section>
  );
}
