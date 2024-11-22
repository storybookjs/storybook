import React, { useEffect, useState } from 'react';

import { EmptyTabContent, Link } from 'storybook/internal/components';
import { useStorybookApi } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { DocumentIcon } from '@storybook/icons';

import { DOCUMENTATION_LINK } from '../constants';

const Links = styled.div(({ theme }) => ({
  display: 'flex',
  fontSize: theme.typography.size.s2 - 1,
  gap: 25,
}));

export const Empty = () => {
  const [isLoading, setIsLoading] = useState(true);
  const api = useStorybookApi();
  const docsUrl = api.getDocsUrl({
    subpath: DOCUMENTATION_LINK,
    versioned: true,
    renderer: true,
  });

  // We are adding a small delay to avoid flickering when the story is loading.
  // It takes a bit of time for the controls to appear, so we don't want
  // to show the empty state for a split second.
  useEffect(() => {
    const load = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(load);
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <EmptyTabContent
      title="Component testing"
      description={
        <>
          Your component rendered successfully. Add a play function to this story to test its
          functionality, which will be displayed here.
        </>
      }
      footer={
        <Links>
          <Link href={docsUrl} target="_blank" withArrow>
            <DocumentIcon /> Read docs
          </Link>
        </Links>
      }
    />
  );
};
