import React, { useRef } from 'react';

import { Match } from 'storybook/internal/router';

import { styled } from 'storybook/theming';

import { MEDIA_DESKTOP_BREAKPOINT } from '../../constants';
import { useLandmark } from '../../hooks/useLandmark';

interface PagesContainerProps {
  children: React.ReactNode;
}

const PagesInnerContainer = styled.main(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gridRowStart: 'sidebar-start',
  gridRowEnd: '-1',
  gridColumnStart: 'sidebar-end',
  gridColumnEnd: '-1',
  backgroundColor: theme.appContentBg,
  zIndex: 1,
}));

/**
 * Shows Router-controlled pages (e.g. settings/about), inside a landmark for navigability. Assumes
 * that the main preview area is not concurrently reachable by assistive technologies, since these
 * components both define a `main` role.
 */
const PagesContainer = React.memo<PagesContainerProps>(function PagesContainer(props) {
  const { children } = props;

  const mainRef = useRef<HTMLElement>(null);
  const { landmarkProps } = useLandmark(
    { 'aria-labelledby': 'main-content-heading', role: 'main' },
    mainRef
  );

  return (
    <PagesInnerContainer id="main-content-wrapper" ref={mainRef} {...landmarkProps}>
      <h2 id="main-content-heading" className="sb-sr-only">
        Main content
      </h2>
      {children}
    </PagesInnerContainer>
  );
});

const MainInnerContainer = styled.div<{ shown: boolean }>(({ theme, shown }) => ({
  flex: 1,
  position: 'relative',
  backgroundColor: theme.appContentBg,
  display: shown ? 'grid' : 'none', // This is needed to make the content container fill the available space
  overflow: 'auto',

  [MEDIA_DESKTOP_BREAKPOINT]: {
    flex: 'auto',
    gridArea: 'content',
  },
}));

interface MainAreaContainerProps {
  showPages: boolean;
  slotMain: React.ReactNode;
  slotPages: React.ReactNode;
}

/**
 * Shows Router-controlled pages (e.g. settings/about), inside a landmark for navigability. Assumes
 * that the main preview area is not concurrently reachable by assistive technologies, since these
 * components both define a `main` role.
 */
const MainAreaContainer = React.memo<MainAreaContainerProps>(function MainAreaContainer({
  showPages,
  slotMain,
  slotPages,
}) {
  return (
    <>
      {showPages && <PagesContainer>{slotPages}</PagesContainer>}
      <Match path={/(^\/story|docs|onboarding\/|^\/$)/} startsWith={false}>
        {({ match }) => (
          <MainInnerContainer
            shown={!!match}
            // Ensures only one main landmark is in the Accessibility Object Model at any given time
            hidden={showPages ? true : undefined}
            aria-hidden={showPages ? true : undefined}
          >
            {slotMain}
          </MainInnerContainer>
        )}
      </Match>
    </>
  );
});

export { MainAreaContainer };
