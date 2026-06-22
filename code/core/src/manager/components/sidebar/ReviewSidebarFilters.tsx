import React from 'react';

import { styled } from 'storybook/theming';

import ReviewChangesButton from './ReviewChangesButton.tsx';

const Container = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: -8,
  '&:empty': {
    display: 'none',
  },
});

/** Quick-filter CTA between the search field and story tree. */
const ReviewSidebarFilters = () => (
  <Container>
    <ReviewChangesButton />
  </Container>
);

export default ReviewSidebarFilters;
