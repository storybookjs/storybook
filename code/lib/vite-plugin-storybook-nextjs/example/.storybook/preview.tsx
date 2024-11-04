import type { Preview } from "@storybook/react";

import "./global.css";
/**
 * This external stylesheet import checks Next.js' external stylesheet support
 * by referencing Bootstrap's css in ./src/app/components/BootstrapButton/BootstrapButton.tsx
 * https://nextjs.org/docs/app/building-your-application/styling/css-modules#external-stylesheets
 */
import "bootstrap/dist/css/bootstrap.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    react: { rsc: true },
  },
};

export default preview;
