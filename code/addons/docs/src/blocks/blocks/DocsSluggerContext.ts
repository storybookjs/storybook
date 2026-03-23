import type { Context } from 'react';
import { createContext } from 'react';

import GithubSlugger from 'github-slugger';

export type DocsSlugger = GithubSlugger;

export const createDocsSlugger = () => new GithubSlugger();

// Share the context on globalThis so provider/consumer pairs still match if bundling duplicates
// this module, which can happen with Vite-based docs builds.
if (globalThis && globalThis.__DOCS_SLUGGER_CONTEXT__ === undefined) {
  globalThis.__DOCS_SLUGGER_CONTEXT__ = createContext<DocsSlugger | null>(null);
  globalThis.__DOCS_SLUGGER_CONTEXT__.displayName = 'DocsSluggerContext';
}

export const DocsSluggerContext: Context<DocsSlugger | null> = globalThis
  ? globalThis.__DOCS_SLUGGER_CONTEXT__
  : createContext<DocsSlugger | null>(null);
