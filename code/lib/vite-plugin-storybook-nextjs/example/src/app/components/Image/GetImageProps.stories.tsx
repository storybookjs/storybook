import { type ImageProps, getImageProps } from "next/image";
import React from "react";

import Accessibility from "./assets/accessibility.svg";
import Testing from "./assets/testing.png";

const Component = (props: ImageProps) => {
  const {
    props: { srcSet: dark },
  } = getImageProps({ ...props, src: Accessibility });
  const {
    props: { srcSet: light, ...rest },
  } = getImageProps({ ...props, src: Testing });

  return (
    <picture>
      <source media="(prefers-color-scheme: dark)" srcSet={dark} />
      <source media="(prefers-color-scheme: light)" srcSet={light} />
      {/* biome-ignore lint/a11y/useAltText: <explanation> */}
      <img {...rest} />
    </picture>
  );
};

export default {
  component: Component,
  args: {
    alt: "getImageProps Example",
  },
};

export const Default = {};
