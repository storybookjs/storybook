import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import Home from "./Link";

describe("Page", () => {
	it("renders a heading", () => {
		const { container } = render(<Home />);

		const heading = screen.getByRole("heading", { level: 1 });

		expect(container).toMatchSnapshot();
		expect(heading).toBeInTheDocument();
	});
});
