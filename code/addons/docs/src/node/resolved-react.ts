import './hooks.ts';

import { fileURLToPath } from 'node:url';

import { resolvePackageDir } from '@storybook/core/internal/common';
import type { Storybook } from '@storybook/core';

/** Package paths that react, react-dom and `@mdx-js/react` imports alias to. */
export type ReactAliases = { react: string; reactDom: string; mdx: string };

/** Fill aliases nobody resolved with the packages addon-docs ships, never overriding one. */
export function withDocsReact(existing: Partial<ReactAliases> | undefined): ReactAliases {
  return {
    react: existing?.react ?? resolvePackageDir('react'),
    reactDom: existing?.reactDom ?? resolvePackageDir('react-dom'),
    // Explicit, because a symlinked MDX file cannot resolve an unhoisted `@mdx-js/react`.
    mdx: existing?.mdx ?? fileURLToPath(import.meta.resolve('@mdx-js/react')),
  };
}

/** Resolve the user's react packages, or the ones shipped with addon-docs. */
export async function getResolvedReact(
  storybook: Pick<Storybook, 'callHook'>
): Promise<ReactAliases> {
  return withDocsReact(await storybook.callHook('legacy:resolvedReact:extend', {}));
}
