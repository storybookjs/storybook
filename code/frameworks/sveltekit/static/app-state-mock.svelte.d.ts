// Types of `app-state-mock.svelte.js`, which ships as JavaScript because Svelte compiles its runes
// in the user's project
import type { Mock } from 'storybook/test';

interface NavigationTarget {
  params: Record<string, string> | null;
  route: { id: string | null };
  url: URL;
}

export interface Page {
  url: URL;
  params: Record<string, string>;
  route: { id: string | null };
  status: number;
  error: { message: string } | null;
  data: Record<string, any>;
  state: Record<string, any>;
  form: any;
}

export interface Navigating {
  from: NavigationTarget | null;
  to: NavigationTarget | null;
  type: 'form' | 'leave' | 'link' | 'goto' | 'popstate' | null;
  willUnload: boolean | null;
  delta: number | null;
  complete: Promise<void> | null;
}

export declare let page: Page;
export declare let navigating: Navigating;
export declare let updated: { current: boolean; check: Mock<() => Promise<boolean>> };

/** Resets `page`, `navigating` and `updated` to their defaults. The framework calls it before every story. */
export declare function resetAppState(): void;

/** Tells if a write went into a default value of `page`, which its setters don't see. */
export declare function pageDefaultsChanged(): boolean;
