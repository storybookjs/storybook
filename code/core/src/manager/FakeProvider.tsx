import React from 'react';

import { styled } from '@storybook/core/theming';

import { addons } from '@storybook/core/manager-api';

import Provider from './provider';

export class FakeProvider extends Provider {
  constructor() {
    super();

    // @ts-expect-error (Converted from ts-ignore)
    this.addons = addons;
    // @ts-expect-error (Converted from ts-ignore)
    this.channel = {
      on: () => {},
      once: () => {},
      off: () => {},
      emit: () => {},
      addListener: () => {},
      removeListener: () => {},
    };
  }

  // @ts-expect-error (Converted from ts-ignore)
  getElements(type) {
    return addons.getElements(type);
  }

  renderPreview() {
    return <div>This is from a 'renderPreview' call from FakeProvider</div>;
  }

  // @ts-expect-error (Converted from ts-ignore)
  handleAPI(api) {
    addons.loadAddons(api);
  }

  getConfig() {
    return {};
  }
}

export const Centered = styled.div({
  width: '100vw',
  height: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'column',
});

export class PrettyFakeProvider extends FakeProvider {
  renderPreview(...args: any[]) {
    return (
      <Centered>
        This is from a 'renderPreview' call from FakeProvider
        <hr />
        'renderPreview' was called with:
        <pre>{JSON.stringify(args, null, 2)}</pre>
      </Centered>
    );
  }
}
