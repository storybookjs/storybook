import React from 'react';

import { styled } from '@storybook/core/theming';

import { addons } from '@storybook/core/manager-api';

import Provider from './provider';

export const FakeProvider = () => {
  // @ts-expect-error (Converted from ts-ignore)
  const addonsInstance = addons;
  // @ts-expect-error (Converted from ts-ignore)
  const channel = {
    on: () => {},
    once: () => {},
    off: () => {},
    emit: () => {},
    addListener: () => {},
    removeListener: () => {},
  };

  // @ts-expect-error (Converted from ts-ignore)
  const getElements = (type: string) => addonsInstance.getElements(type);

  const renderPreview = () => <div>This is from a 'renderPreview' call from FakeProvider</div>;

  const handleAPI = (api: any) => addonsInstance.loadAddons(api);

  const getConfig = () => ({});

  return (
    <Provider
      renderPreview={renderPreview}
      getElements={getElements}
      handleAPI={handleAPI}
      getConfig={getConfig}
    />
  );
};

export const Centered = styled.div({
  width: '100vw',
  height: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'column',
});

export const PrettyFakeProvider = (props: any) => {
  return (
    <Centered>
      This is from a 'renderPreview' call from FakeProvider
      <hr />
      'renderPreview' was called with:
      <pre>{JSON.stringify(props, null, 2)}</pre>
    </Centered>
  );
};
