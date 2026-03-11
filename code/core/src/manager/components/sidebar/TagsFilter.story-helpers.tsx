import React from 'react';

import { Channel } from 'storybook/internal/channels';
import type { API_Provider, DecoratorFunction } from 'storybook/internal/types';

import { deepMerge } from '@vitest/utils';
import type { API, State } from 'storybook/manager-api';
import { fn } from 'storybook/test';

import type { ModuleArgs, ModuleFn } from '../../../manager-api/lib/types';
import { init as initStories } from '../../../manager-api/modules/stories';
import { createTestingStore } from '../../../manager-api/test-utils/store';

/** Mock API wrapper that forces component updates when store state changes. */
export class MockAPIWrapper<SubAPI, SubState> extends React.Component<{
  children: React.ReactNode;
  args: Record<string, unknown>;
  initFn: ModuleFn<SubAPI, SubState>;
  initOptions?: Partial<ModuleArgs>;
  initialStoryState?: Partial<State>;
}> {
  api: ReturnType<typeof initStories>['api'];
  store: ReturnType<typeof createTestingStore>;
  channel: API_Provider<API>['channel'];
  mounted: boolean;

  constructor(props: {
    children: React.ReactNode;
    args: Record<string, unknown>;
    initFn: ModuleFn<SubAPI, SubState>;
    initOptions?: Partial<ModuleArgs>;
    initialStoryState?: Partial<State>;
  }) {
    super(props);

    // Set up store.
    this.mounted = false;
    this.store = createTestingStore({} as State, (newState) => {
      if (this.mounted) {
        this.setState(newState);
      }
    });

    // Mock channel and provider.
    this.channel = new Channel({}) satisfies API_Provider<API>['channel'];
    const provider: API_Provider<API> = {
      getConfig: () => ({}),
      handleAPI: () => {},
      channel: this.channel,
    };

    // Mock other submodules we depend on.
    const fullAPI = {
      experimental_setFilter: fn().mockName('API::experimental_setFilter'),
      getRefs: fn().mockName('API::getRefs').mockReturnValue({}),
      setRef: fn().mockName('API::setRef'),
      updateRef: fn().mockName('API::updateRef'),
      setOptions: fn().mockName('API::setOptions'),
    } as unknown as API;

    const { api, init, state } = props.initFn({
      fullAPI,
      store: this.store,
      provider,
      location: { search: '' },
      navigate: () => {},
      path: '',
      docsOptions: {},
      state: {} as State,
      ...(props.initOptions ?? {}),
    });

    // Apply module and initial story states.
    if (props.initialStoryState) {
      this.store.setState(deepMerge<State>(state as State, props.initialStoryState));
    } else {
      this.store.setState(state as State);
    }

    // Call module's post init function if it exists.
    if (init && typeof init === 'function') {
      init();
    }

    this.api = api as API;
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  render() {
    const { children, args } = this.props;
    return (
      <>
        {React.cloneElement(children as React.ReactElement, {
          args: {
            ...args,
            api: {
              ...this.api,
              getDocsUrl: () => 'https://storybook.js.org/docs/',
              getUrlState: () => ({
                queryParams: {},
                path: '',
                viewMode: 'story',
                url: 'http://localhost:6006/',
              }),
              applyQueryParams: fn().mockName('api::applyQueryParams'),
            },
          },
        })}
      </>
    );
  }
}

export const MockAPIDecorator: DecoratorFunction = (Story, { args, parameters }) => (
  <MockAPIWrapper
    args={args}
    initFn={initStories}
    initialStoryState={parameters?.initialStoryState}
    initOptions={{ singleStory: false }}
  >
    <Story />
  </MockAPIWrapper>
);
