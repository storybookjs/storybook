import type { FlightRouterState } from 'next/dist/server/app-render/types';

type ParamSegment = [param: string, value: string, type: 'd'];
type Segment = string | ParamSegment;

export function buildFlightRouterState(
  routePattern: string,
  pathname: string,
  search: string
): FlightRouterState {
  /* ── helpers ───────────────────────────────────────────────────────────── */
  const stripSlash = (s: string) => s.replace(/^\/|\/$/g, '');
  const isDynamic = (seg: string) => /^\[.+]$/.test(seg);

  const patternSegs = stripSlash(routePattern).split('/').filter(Boolean);
  const pathSegs = stripSlash(pathname).split('/').filter(Boolean);

  if (patternSegs.length !== pathSegs.length) {
    throw new Error(`Pattern “${routePattern}” does not match pathname “${pathname}”.`);
  }

  /* ── page-leaf creator ─────────────────────────────────────────────────── */
  const queryObj = Object.fromEntries(new URLSearchParams(search));
  const querySuffix = Object.keys(queryObj).length === 0 ? '' : `?${JSON.stringify(queryObj)}`;

  const makePageState = (fullPath: string): FlightRouterState => [
    '__PAGE__' + querySuffix,
    {},
    fullPath,
    'refresh',
  ];

  /* ── recursive descent over segments ───────────────────────────────────── */
  const descend = (idx: number, accPath: string): FlightRouterState => {
    if (idx >= patternSegs.length) {
      // All segments consumed ⇒ we’re at the page leaf
      return makePageState(accPath || '/' + search);
    }

    const patternSeg = patternSegs[idx]!;
    const pathSeg = pathSegs[idx]!;
    const nextAcc = `${accPath}/${pathSeg}`;

    const segment: Segment = isDynamic(patternSeg)
      ? [patternSeg.slice(1, -1), pathSeg, 'd']
      : patternSeg;

    return [segment, { children: descend(idx + 1, nextAcc) }];
  };

  /* ── root wrapper ──────────────────────────────────────────────────────── */
  const childState =
    patternSegs.length === 0
      ? makePageState('/' + (search.startsWith('?') ? search.slice(1) : search))
      : descend(0, '');

  return [
    '',
    { children: childState },
    undefined,
    undefined,
    true, // ← marks root layout
  ];
}
