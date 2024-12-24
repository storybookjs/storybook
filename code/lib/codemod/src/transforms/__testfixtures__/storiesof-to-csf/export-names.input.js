import React from 'react';
import { storiesOf } from '@storybook/react';
import FlexCenter from './FlexCenter';
import { specs, urls } from './LiveView.stories';
import { ignoredRegions } from './IgnoredRegions.stories';

export { specs, urls, ignoredRegions };

storiesOf('FlexCenter', module).add('2:1', () => (
  <FlexCenter width={200} height={100} style={{ background: 'papayawhip' }}>
    <div style={{ padding: 30, background: 'hotpink' }}>2:1</div>
  </FlexCenter>
));
