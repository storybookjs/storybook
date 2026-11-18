/*
 * Types of the SvelteKit APIs that the mocks implement, copied from `@sveltejs/kit` (a peer
 * dependency that the monorepo doesn't install) and loosened where a story doesn't need to pass a
 * value: the result `location` and the navigation targets' `params` and `route`.
 */

export type NavigationTarget = {
  params?: Record<string, string> | null;
  route?: { id: string | null };
  url: URL;
};

/** The argument of an `afterNavigate` callback. */
export type AfterNavigate = {
  type: 'enter' | 'form' | 'link' | 'goto' | 'popstate';
  from: NavigationTarget | null;
  to: NavigationTarget | null;
  shallow: boolean;
  willUnload: false;
  delta?: number;
  complete: Promise<void>;
};

/** The result of a form action, which `formAction` resolves to. */
export type ActionResult<
  Success extends Record<string, unknown> | undefined = Record<string, any>,
  Failure extends Record<string, unknown> | undefined = Record<string, any>,
> =
  | { type: 'success'; status: number; data?: Success; location?: string }
  | { type: 'failure'; status: number; data?: Failure; location?: string }
  | { type: 'redirect'; status: number; location: string }
  | { type: 'error'; status?: number; error: any; location?: string };

/** What `formAction` receives: the form submission that SvelteKit would send to the server. */
export type FormSubmission = {
  action: URL;
  formData: FormData;
  formElement: HTMLFormElement;
  submitter: HTMLElement | null;
};

export type UpdateOptions = {
  reset?: boolean;
  refreshAll?: boolean;
  /** @deprecated Use `refreshAll` instead. */
  invalidateAll?: boolean;
};

export type SubmitFunction = (
  input: FormSubmission & { controller: AbortController; cancel: () => void }
) => void | SubmitCallback | Promise<void | SubmitCallback>;

type SubmitCallback = (opts: {
  formData: FormData;
  formElement: HTMLFormElement;
  action: URL;
  result: ActionResult;
  update: (options?: UpdateOptions) => Promise<void>;
}) => void | Promise<void>;
