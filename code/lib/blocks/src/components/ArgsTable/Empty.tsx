import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { styled } from 'storybook/internal/theming';
import { Link, EmptyTabContent } from 'storybook/internal/components';
import { DocumentIcon, VideoIcon } from '@storybook/icons';

interface EmptyProps {
  inAddonPanel?: boolean;
}

const Wrapper = styled.div<{ inAddonPanel?: boolean }>(({ inAddonPanel, theme }) => ({
  height: inAddonPanel ? '100%' : 'auto',
  display: 'flex',
  border: inAddonPanel ? 'none' : `1px solid ${theme.appBorderColor}`,
  borderRadius: inAddonPanel ? 0 : theme.appBorderRadius,
  padding: inAddonPanel ? 0 : 40,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'column',
  gap: 15,
  background: theme.background.content,
  boxShadow: 'rgba(0, 0, 0, 0.10) 0 1px 3px 0',
}));

const Links = styled.div(({ theme }) => ({
  display: 'flex',
  fontSize: theme.typography.size.s2 - 1,
  gap: 25,
}));

const Divider = styled.div(({ theme }) => ({
  width: 1,
  height: 16,
  backgroundColor: theme.appBorderColor,
}));

export const Empty: FC<EmptyProps> = ({ inAddonPanel }) => {
  const [isLoading, setIsLoading] = useState(true);

  // We are adding a small delay to avoid flickering when the story is loading.
  // It takes a bit of time for the controls to appear, so we don't want
  // to show the empty state for a split second.
  useEffect(() => {
    const load = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(load);
  }, []);

  if (isLoading) return null;

  return (
    <Wrapper inAddonPanel={inAddonPanel}>
      <EmptyTabContent
        title={
          inAddonPanel
            ? 'Interactive story playground'
            : "Args table with interactive controls couldn't be auto-generated"
        }
        description={
          <>
            Controls give you an easy to use interface to test your components. Set your story args
            and you&apos;ll see controls appearing here automatically.
          </>
        }
        footer={
          <Links>
            {inAddonPanel && (
              <>
                <Link href="https://youtu.be/0gOfS6K0x0E" target="_blank" withArrow>
                  <VideoIcon /> Watch 5m video
                </Link>
                <Divider />
                <Link
                  href="https://storybook.js.org/docs/essentials/controls"
                  target="_blank"
                  withArrow
                >
                  <DocumentIcon /> Read docs
                </Link>
              </>
            )}
            {!inAddonPanel && (
              <Link
                href="https://storybook.js.org/docs/essentials/controls"
                target="_blank"
                withArrow
              >
                <DocumentIcon /> Learn how to set that up
              </Link>
            )}
          </Links>
        }
      />
    </Wrapper>
  );
};
