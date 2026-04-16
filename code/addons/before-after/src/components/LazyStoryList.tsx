import React, { useEffect, useRef, useState, type ReactNode } from 'react';

import { styled } from 'storybook/theming';

const ScrollContainer = styled.div({
  flex: 1,
  overflow: 'auto',
  padding: '16px',
});

const StoryPlaceholder = styled.div<{ height: number }>(({ height }) => ({
  minHeight: height,
  position: 'relative',
}));

const SkeletonLoader = styled.div(({ theme }) => ({
  width: '100%',
  height: '200px',
  background: `linear-gradient(90deg, ${theme.background.hoverable} 25%, ${theme.background.app} 50%, ${theme.background.hoverable} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '4px',
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '200% 0' },
    '100%': { backgroundPosition: '-200% 0' },
  },
}));

interface LazyMountProps {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
}

const LazyMount = ({ children, minHeight = 200, rootMargin = '100% 0px' }: LazyMountProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          observer.disconnect(); // Keep-alive: never unmount once mounted
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <StoryPlaceholder ref={ref} height={minHeight}>
      {mounted ? children : <SkeletonLoader />}
    </StoryPlaceholder>
  );
};

interface LazyStoryListProps {
  children: ReactNode;
}

export const LazyStoryList = ({ children }: LazyStoryListProps) => {
  return (
    <ScrollContainer>
      {React.Children.map(children, (child) => {
        return child;
      })}
    </ScrollContainer>
  );
};

// Export LazyMount for use in StoryCard wrapping
export { LazyMount };
