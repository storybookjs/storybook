import type { ReactElement } from 'react';
import React, { useEffect, useRef, useState } from 'react';

import { styled } from 'storybook/theming';

const Wrapper = styled.div({
  display: 'inline-grid',
  gridTemplateColumns: 'max-content',
  overflow: 'hidden',
});

const Content = styled.div<{ isHidden: boolean | null }>(({ isHidden }) => ({
  display: 'inline-block',
  gridArea: '1/1',
  opacity: isHidden === null ? 0 : 1,
  visibility: isHidden ? 'hidden' : 'visible',
}));

export const Optional = ({
  content,
  fallback,
}: {
  content: ReactElement;
  fallback?: ReactElement;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState<boolean | null>(null);

  const contentWidth = useRef(contentRef.current?.offsetWidth ?? 0);
  const wrapperWidth = useRef(wrapperRef.current?.offsetWidth ?? 0);

  useEffect(() => {
    if (contentRef.current && wrapperRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        wrapperWidth.current = wrapperRef.current?.offsetWidth || wrapperWidth.current;
        contentWidth.current = contentRef.current?.offsetWidth || contentWidth.current;
        setHidden(contentWidth.current > wrapperWidth.current);
      });
      resizeObserver.observe(wrapperRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  return (
    <Wrapper ref={wrapperRef}>
      <Content isHidden={hidden} ref={contentRef}>
        {content}
      </Content>

      {fallback && <Content isHidden={!hidden}>{fallback}</Content>}
    </Wrapper>
  );
};
