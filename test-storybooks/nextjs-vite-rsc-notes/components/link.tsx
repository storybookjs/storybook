import { Link as ProgressLink } from "react-transition-progress/next";
import type { ComponentProps } from "react";

type LinkProps = ComponentProps<typeof ProgressLink>;

export function Link(props: LinkProps) {
  return <ProgressLink {...props} />;
}
