import React, { Fragment } from 'react';

import { Placeholder } from './placeholder';
import { Link } from '../typography/link/link';

export default {
  component: Placeholder,
};

export const SingleChild = () => (
  <Placeholder>This is a placeholder with single child, it's bolded</Placeholder>
);
export const TwoChildren = () => (
  <Placeholder>
    <Fragment key="title">This has two children, the first bold</Fragment>
    <Fragment key="desc">
      The second normal weight. Here's a&nbsp;
      <Link href="https://storybook.js.org" secondary cancel={false}>
        link
      </Link>
    </Fragment>
  </Placeholder>
);
