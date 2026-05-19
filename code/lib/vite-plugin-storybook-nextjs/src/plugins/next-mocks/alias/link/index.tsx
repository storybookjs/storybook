import type { LinkProps } from "next/link";
import React from "react";
import { fn } from "storybook/test";

const linkAction = fn().mockName("next/link::Link");

type MockLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: React.ReactNode;
  };

const MockLink = React.forwardRef<HTMLAnchorElement, MockLinkProps>(
  function MockLink(
    {
      href,
      as: _as,
      replace,
      scroll,
      shallow,
      prefetch,
      passHref,
      legacyBehavior,
      locale,
      onClick,
      children,
      ...rest
    },
    ref,
  ) {
    const hrefString =
      typeof href === "object"
        ? `${href.pathname || ""}${
            href.query
              ? `?${new URLSearchParams(
                  href.query as Record<string, string>,
                ).toString()}`
              : ""
          }${href.hash || ""}`
        : href;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      onClick?.(e);
      linkAction(hrefString, { replace, scroll, shallow, prefetch, locale });
    };

    if (legacyBehavior) {
      const child = React.Children.only(children) as React.ReactElement<
        React.AnchorHTMLAttributes<HTMLAnchorElement>
      >;
      const childProps: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
        ref?: React.Ref<HTMLAnchorElement>;
      } = {
        ref,
        onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          if (child.props && typeof child.props.onClick === "function") {
            child.props.onClick(e);
          }
          linkAction(hrefString, {
            replace,
            scroll,
            shallow,
            prefetch,
            locale,
          });
        },
        ...rest,
      };

      if (
        passHref ||
        (child.type === "a" && !("href" in (child.props || {})))
      ) {
        childProps.href = hrefString;
      }

      return React.cloneElement(child, childProps);
    }

    return (
      <a ref={ref} href={hrefString} onClick={handleClick} {...rest}>
        {children}
      </a>
    );
  },
);

MockLink.displayName = "NextLink";

export default MockLink;
export { MockLink as Link };

export const useLinkStatus = fn((): { pending: boolean } => ({
  pending: false,
})).mockName("next/link::useLinkStatus");
