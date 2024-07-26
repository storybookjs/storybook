import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Font from "./Font";

describe("Font", () => {
  it("should render correctly with className", () => {
    const { getByText } = render(<Font variant="className" />);

    const heading = getByText("Google Kalina");
    expect(heading.className).toBe("kalnia-normal");
    expect(heading.style.fontFamily).toBeFalsy();
  });

  it("should render correctly with style", () => {
    const { getByText } = render(<Font variant="style" />);

    const heading = getByText("Google Kalina");
    expect(heading.style.fontFamily).toBe("Kalnia");
  });

  it("should render correctly with variable", () => {
    const { getByText } = render(<Font variant="variable" />);

    const heading = getByText("Google Kalina");
    expect(heading.style.fontFamily).toBe("var(--font-kalina)");
  });
});
