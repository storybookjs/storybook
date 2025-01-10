import React from 'react';

// NOTE: this is a copy of `code/ui/components/src/navigation/RoutedLink.tsx`.
// It's duplicated here because that copy has an explicit dependency on
// React 16.3+, which breaks older versions of React running in the preview.
// The proper DRY solution is to create a new package that doesn't depend
// on a specific react version. However, that's a heavy-handed solution for
// one trivial file.

const LEFT_BUTTON = 0;
// Cmd/Ctrl/Shift/Alt + Click should trigger default browser behaviour. Same applies to non-left clicks
const isPlainLeftClick = (e: React.MouseEvent) =>
  e.button === LEFT_BUTTON && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

const RoutedLink: React.FC<
  React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>
> = ({ href = '#', children, onClick, className, style }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isPlainLeftClick(e)) {
      e.preventDefault();
      if (onClick) {
        onClick(e);
      }
    }
  };

  const props = onClick
    ? { href, className, style, onClick: handleClick }
    : { href, className, style };
  return <a {...props}>{children}</a>;
};

export default RoutedLink;
