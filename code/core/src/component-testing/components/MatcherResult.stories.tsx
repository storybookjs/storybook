import React from 'react';

import { styled } from 'storybook/theming';
import { dedent } from 'ts-dedent';

import { MatcherResult } from './MatcherResult';

const StyledWrapper = styled.div({
  backgroundColor: 'var(--sb-background-content)',
  padding: '12px 0',
  boxShadow: `0 0 0 1px var(--sb-appBorderColor)`,
  color: 'var(--sb-color-defaultText)',
  fontSize: `calc(var(--sb-typography-size-s2) - 1px)`,
});

export default {
  title: 'MatcherResult',
  component: MatcherResult,
  decorators: [
    (Story: any) => (
      <StyledWrapper>
        <Story />
      </StyledWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export const Expected = {
  args: {
    message: dedent`
      expected last "spy" call to have been called with [ { …(2) } ]
      
      - Expected: 
      Array [
        Object {
          "email": "michael@chromatic.com",
          "password": "testpasswordthatwontfail",
        },
      ]
      
      + Received: 
      undefined
    `,
  },
};

export const ExpectedReceived = {
  args: {
    message: dedent`
      expected last "spy" call to have been called with []
      
      - Expected
      + Received
      
      - Array []
      + Array [
      +   Object {
      +     "email": "michael@chromatic.com",
      +     "password": "testpasswordthatwontfail",
      +   },
      + ]
    `,
  },
};

export const ExpectedNumberOfCalls = {
  args: {
    message: dedent`
      expected "spy" to not be called at all, but actually been called 1 times
      
      Received: 
      
        1st spy call:
      
          Array [
            Object {
              "email": "michael@chromatic.com",
              "password": "testpasswordthatwontfail",
            },
          ]
      
      
      Number of calls: 1
    `,
  },
};

export const Diff = {
  args: {
    message: dedent`
      expected "spy" to be called with arguments: [ { …(2) } ]
      
      Received: 
      
        1st spy call:
      
        Array [
          Object {
      -     "email": "michael@chromaui.com",
      +     "email": "michael@chromatic.com",
            "password": "testpasswordthatwontfail",
          },
        ]
      
      
      Number of calls: 1
    `,
  },
};
