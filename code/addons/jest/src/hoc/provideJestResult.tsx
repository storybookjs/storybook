import type { ComponentType } from 'react';
import React, { Component as ReactComponent } from 'react';
import { STORY_CHANGED } from 'storybook/internal/core-events';
import type { API } from 'storybook/internal/manager-api';
import { ADD_TESTS } from '../shared';

// TODO: import type from @types/jest
interface AssertionResult {
  status: string;
  fullName: string;
  title: string;
  failureMessages: string[];
}

export interface Test {
  name: string;
  result: {
    status: string;
    startTime?: number;
    endTime?: number;
    assertionResults: AssertionResult[];
  };
}

interface InjectedProps {
  tests?: Test[];
}

export interface HocProps {
  api: API;
  active?: boolean;
}

export interface HocState {
  kind?: string;
  storyName?: string;
  tests?: Test[];
}

export const provideTests = (Component: ComponentType<InjectedProps>) =>
  class TestProvider extends ReactComponent<HocProps, HocState> {
    state: HocState = {};

    static defaultProps = {
      active: false,
    };

    componentDidMount() {
      this.mounted = true;
      const { api } = this.props;

      this.stopListeningOnStory = api.on(STORY_CHANGED, () => {
        const { kind, storyName, tests } = this.state;
        if (this.mounted && (kind || storyName || tests)) {
          this.onAddTests({});
        }
      });

      api.on(ADD_TESTS, this.onAddTests);
    }

    componentWillUnmount() {
      this.mounted = false;
      const { api } = this.props;

      this.stopListeningOnStory();
      api.off(ADD_TESTS, this.onAddTests);
    }

    onAddTests = ({ kind, storyName, tests }: HocState) => {
      this.setState({ kind, storyName, tests });
    };

    mounted!: boolean;

    stopListeningOnStory!: () => void;

    render() {
      const { active } = this.props;
      const { tests } = this.state;

      return active ? <Component tests={tests} /> : null;
    }
  };
