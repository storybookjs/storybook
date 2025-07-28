import "@testing-library/jest-dom";
import { setProjectAnnotations } from "@storybook/nextjs";

import sbAnnotations from "./.storybook/preview";

setProjectAnnotations([sbAnnotations]);
