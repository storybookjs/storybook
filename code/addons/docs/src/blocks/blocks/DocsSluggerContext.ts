import type { Context } from 'react';
import { createContext } from 'react';

import GithubSlugger from 'github-slugger';

export type DocsSlugger = GithubSlugger;

export const createDocsSlugger = () => new GithubSlugger();

export const DocsSluggerContext: Context<DocsSlugger | null> = createContext<DocsSlugger | null>(
  null
);
