import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import Example from "./Example";

describe("Example", () => {
	it("should render correctly", () => {
		render(<Example />);
		expect(screen.getByText("Hello World")).toBeInTheDocument();
	});
});
