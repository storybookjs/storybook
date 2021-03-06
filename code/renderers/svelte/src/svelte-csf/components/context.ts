import { getContext, hasContext, setContext } from "svelte";

const CONTEXT_KEY = "storybook-registration-context";

export function createRenderContext(props: any = {}) {
  setContext(CONTEXT_KEY, {
    render: true,
    register: () => {},
    meta: {},
    args: {},
    ...props,
  });
}

export function createRegistrationContext(repositories: any) {
  setContext(CONTEXT_KEY, {
    render: false,
    register: (story: any) => {
      repositories.stories.push(story);
    },
    set meta(value: any) {
      // eslint-disable-next-line no-param-reassign
      repositories.meta = value;
    },
    args: {},
  });
}

export function useContext() {
  if (!hasContext(CONTEXT_KEY)) {
    createRenderContext();
  }
  return getContext(CONTEXT_KEY);
}
