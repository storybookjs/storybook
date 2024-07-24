import { render } from "@testing-library/react";
import { describe, it } from "vitest";
import Font from "./Font";

// Write three test cases with vitest where variant is "className", "style", and "variable" for the Font component.
describe("Font", () => {
  it("should render correctly with className", () => {
    const { container } = render(<Font variant="className" />);

    // Write your test case here
  });

  it("should render correctly with style", () => {
    const { container } = render(<Font variant="className" />);
    // Write your test case here
  });

  it("should render correctly with variable", () => {
    const { container } = render(<Font variant="className" />);
    // Write your test case here
  });
});
