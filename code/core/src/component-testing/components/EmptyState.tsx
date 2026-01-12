import React, { useEffect, useState } from 'react';

import { EmptyTabContent, Link } from 'storybook/internal/components';

import { DocumentIcon } from '@storybook/icons';

import { useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { DOCUMENTATION_PLAY_FUNCTION_LINK } from '../constants';

const Links = styled.div({
  display: 'flex',
  fontSize: `calc(var(--sb-typography-size-s2) - 1px)`,
  gap: 25,
});

export const Empty = () => {
  const [isLoading, setIsLoading] = useState(true);
  const api = useStorybookApi();
  const docsUrl = api.getDocsUrl({
    subpath: DOCUMENTATION_PLAY_FUNCTION_LINK,
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
    <div>
      <EmptyTabContent
        title="Interactions"
        description={
          <>
            Interactions allow you to verify the functional aspects of UIs. Write a play function
            for your story and you&apos;ll see it run here.
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
    </div>
  );
};
