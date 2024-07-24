import Image from "next/legacy/image";
import React, { useRef, useState } from "react";

import type { Meta, StoryObj } from "@storybook/react";
import Accessibility from "./assets/accessibility.svg";
import AvifImage from "./assets/avif-test-image.avif";

const meta = {
  component: Image,
  args: {
    src: Accessibility,
    alt: "Accessibility",
  },
} satisfies Meta<typeof Image>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default = {} satisfies Story;

export const Avif = {
  args: {
    src: AvifImage,
    alt: "Avif Test Image",
  },
} satisfies Story;

export const BlurredPlaceholder = {
  args: {
    placeholder: "blur",
  },
} satisfies Story;

export const BlurredAbsolutePlaceholder = {
  args: {
    src: "https://storybook.js.org/images/placeholders/50x50.png",
    width: 50,
    height: 50,
    blurDataURL:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAABP5JREFUWEeNlwtz2zgMhEGKsv/k9XFp82xe11763yOJVGcXC4m2czM3GYa0E2s/LACSTi+vv1czM/7CvPpqxY/ejPeS3khmFiPHOiVLHKaZi4ux4j18GpMlS6cALupEQBCKQM4BdnGzjIcJgs//QBxAPQAem55f3yL4PWJIdyCyhlMfPdYZot0cwj3Ayg/5JwHA13paen7pADphxr/n5VI8JQsHCCGQ3gVGLLsxQ3h/LYSn5383B05rwNOws3Z576LOTOduvwfrOd5FtVat4akx0uPTrw8BNuUz23vLsY7hmg7i4ipqM2saiAdruNuirh4ff0bNdb3Qy3vkvfAQwrkHoDxTTZtDCOKrC1bMEkdnsQh/PLyetOGHkXeRAgQAQ84efQcBdUhvFofoulpdm9WGGTA+AJEe7l+i37a2c371tCFKs5zzJjxQNBMi1im7OCudP2aNghJuzZaGdSMEZjpwf/t0UgNdg9DOyLGLnY0BUHlzwVtNDkgEQhBeKkb1tUDgQrq7frwAiIJi5BKAeIFgHk5mOpPzvgltOfcoK0Rrs7lWHwsgqtXarK3N0u23h5Ne8+3Cqxn5RYSMfHCAMgDAx4CBWlA9RAGw0GA/ol0gvFB4WjAvBAFUa83SzdUdAbYMqp28uHpxCRefxwAYhksAFBlthxCiXig+zT4TYqkC+Hq7OdAfJv8lPpZiZShWBBIuRP+jspDb2lwcDkzz7OLzbO/zvAHAoXTz5eYMQL0t2yHAiCFcfPY1QDwNFylA5bPoFpsV9fsEiMl8dhcc4PP1CYD3drYcBYdIKQrx0cbRxd2JHSDcQ297/vvoZ5smRC+AyV2AQ+nm03evge08Tyy4jGqXzWWEoIvTgXHU38pWiNgH4ixB/ukAcy/xycXfp4kwdAAAt399W+OCgMjxILQacxvRQ3gEwHgKUIr/rz53CuDFNyP/Eob4+/vEWkBq6AAA/HIi62n/Lk67Q7wDYQ0UpQB7hc54T4E6gACLTYxeAwB0YKZL6U4ATEGIBwCs7qPfQJCCHkCnoK50noJKcXcAojsEAJZZKXhgCoziGKxqWV8IMNp4kP2aC+oB0TMFvhGxDQHQfIPhDrilwKOm/YCZASAHfgBABQjr3f7CyAkA0cPB03AQULRhKd4xAIjzHymo2Gp7gN0FAMAVOoA2fPz03a9ssh/RM7Iz8QKIzYF9HyB0XEZ1xJ4DzNoDOAfAslhDDTyjDfv8A2AcBeCiu/jBHQEgxnYW6Kp6BlCVAkQM8VnieF2Xyr0ivXy+XvsCzKOihwNHCCryw8HrQXVB8dgFeRfAVQiXjMbIIgXINQYB2H7Kf5wF/2Ar7h0AgKKGuAP4zOjhzlkLbpcRXKRZhNUjxG6HIQDOjN47gCn4+fWW3xVS9urPESEEwwHMo9IhAGxS2ISiA1iEnQOoA4hXRAwItp7WzL9Ow18ESJaw/ar4NgeOR49cAHCAnaH8swBhv+6CBGjeBSxEOUAI7HyKHkD4O9xKb3/feQouAI4uLBciHRRHmgbfA7h/xFc9AngNBADthvii1sMOiPwDAFeyt6s7FSFS4PmnA1v0vQvqDqQKAAPE/weAUuEgsj8c+H11Twdw/AKANXA82EDr5cJBEEzB3oI4Mb0AdR3nNw8vQnegWuvqAABwJFJEBwDgNdA7IOs3gL0LhuJdwBY8c4BfNnDdVgooHiOqn/b7JoSW/QODjTHXhU7hMQAAAABJRU5ErkJggg==",
    placeholder: "blur",
  },
  parameters: {
    // ignoring in Chromatic to avoid inconsistent snapshots
    // given that the switch from blur to image is quite fast
    chromatic: { disableSnapshot: true },
  },
} satisfies Story;

export const Lazy = {
  args: {
    src: "https://storybook.js.org/images/placeholders/50x50.png",
    width: 50,
    height: 50,
  },
  decorators: [
    (Story) => (
      <>
        <div style={{ height: "200vh" }} />
        {Story()}
      </>
    ),
  ],
} satisfies Story;

export const Eager = {
  ...Lazy,
  parameters: {
    nextjs: {
      image: {
        loading: "eager",
      },
    },
  },
} satisfies Story;
