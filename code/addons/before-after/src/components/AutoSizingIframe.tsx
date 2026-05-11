import React, { useCallback, useEffect, useRef, useState } from 'react';

import { styled } from 'storybook/theming';

const IframeWrapper = styled.div({
  position: 'relative',
  width: '100%',
});

const StyledIframe = styled.iframe({
  width: '100%',
  border: 'none',
  display: 'block',
  borderRadius: '4px',
});

const LoadingOverlay = styled.div(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(90deg, ${theme.background.hoverable} 25%, ${theme.background.app} 50%, ${theme.background.hoverable} 75%)`,
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
  borderRadius: '4px',
  color: theme.color.mediumdark,
  fontSize: '12px',
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '200% 0' },
    '100%': { backgroundPosition: '-200% 0' },
  },
}));

const ErrorState = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '200px',
  color: theme.color.mediumdark,
  fontSize: '13px',
  gap: '8px',
}));

const RetryButton = styled.button(({ theme }) => ({
  padding: '4px 12px',
  borderRadius: '4px',
  border: `1px solid ${theme.color.border}`,
  background: theme.background.content,
  color: theme.color.defaultText,
  cursor: 'pointer',
  fontSize: '12px',
  '&:hover': {
    background: theme.background.hoverable,
  },
}));

interface AutoSizingIframeProps {
  src: string;
  title: string;
}

const DEFAULT_HEIGHT = 200;
const FALLBACK_HEIGHT = 400;
const FALLBACK_TIMEOUT = 3000;

export const AutoSizingIframe = ({ src, title }: AutoSizingIframeProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const heightSetRef = useRef(false);

  // ResizeObserver for same-origin iframes (both before and after iframes
  // are served from the dev server's origin per ADR-0003).
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let observer: ResizeObserver | null = null;

    const handleLoad = () => {
      setLoaded(true);
      const doc = iframe.contentDocument;
      if (!doc?.body) return;

      observer = new ResizeObserver(() => {
        const newHeight = Math.max(doc.body.scrollHeight, DEFAULT_HEIGHT);
        setHeight(newHeight);
        heightSetRef.current = true;
      });
      observer.observe(doc.body);

      const initialHeight = doc.body.scrollHeight;
      if (initialHeight > 0) {
        setHeight(Math.max(initialHeight, DEFAULT_HEIGHT));
        heightSetRef.current = true;
      }
    };

    iframe.addEventListener('load', handleLoad);
    return () => {
      iframe.removeEventListener('load', handleLoad);
      observer?.disconnect();
    };
  }, [retryKey]);

  // Fallback height after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!heightSetRef.current) {
        setHeight(FALLBACK_HEIGHT);
      }
    }, FALLBACK_TIMEOUT);
    return () => clearTimeout(timer);
  }, [retryKey]);

  const handleError = useCallback(() => {
    setError(true);
  }, []);
  const handleRetry = useCallback(() => {
    setError(false);
    setLoaded(false);
    setRetryKey((k) => k + 1);
  }, []);

  if (error) {
    return (
      <ErrorState>
        Failed to load story preview
        <RetryButton onClick={handleRetry}>Retry</RetryButton>
      </ErrorState>
    );
  }

  return (
    <IframeWrapper>
      {!loaded && <LoadingOverlay>Loading preview...</LoadingOverlay>}
      <StyledIframe
        key={retryKey}
        ref={iframeRef}
        src={src}
        title={title}
        style={{ height: `${height}px`, opacity: loaded ? 1 : 0 }}
        onError={handleError}
      />
    </IframeWrapper>
  );
};
