import { HttpResponse, http } from "msw";

export const nextCacheProbeFetchUrl = "https://vitest-plugin-rsc.test/next-cache-probe";
export const nextCacheProbeNoStoreFetchUrl =
  "https://vitest-plugin-rsc.test/next-cache-probe-no-store";

let fetchVersion = 0;
let noStoreFetchVersion = 0;
let cacheLabel = "default";

export function resetNextCacheProbeFetch(label = "default") {
  fetchVersion = 0;
  noStoreFetchVersion = 0;
  cacheLabel = label;
}

export const nextCacheProbeFetchHandler = [
  http.get(nextCacheProbeFetchUrl, () => {
    fetchVersion += 1;
    return HttpResponse.text(`${cacheLabel} fetch ${fetchVersion}`);
  }),
  http.get(nextCacheProbeNoStoreFetchUrl, () => {
    noStoreFetchVersion += 1;
    return HttpResponse.text(`${cacheLabel} no-store fetch ${noStoreFetchVersion}`);
  }),
];
