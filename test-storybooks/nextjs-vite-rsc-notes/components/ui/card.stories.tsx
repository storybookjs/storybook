import { expect } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { Button } from "./button.tsx";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card.tsx";

// A render function of a story without `"use client"` is a Server Component:
// it composes Server and Client Components, as a page does.
const meta = preview.meta({
  title: "UI/Card",
  tags: ["autodocs"],
  component: Card,
  parameters: { layout: "centered" },
});

export const WithContent = meta.story({
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Reading list</CardTitle>
        <CardDescription>Books to read this quarter.</CardDescription>
      </CardHeader>
      <CardContent>Thinking, Fast and Slow</CardContent>
      <CardFooter>
        <Button variant="outline">Edit</Button>
      </CardFooter>
    </Card>
  ),
  async play({ canvas }) {
    await expect(await canvas.findByText("Reading list")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Edit" })).toBeVisible();
  },
});
