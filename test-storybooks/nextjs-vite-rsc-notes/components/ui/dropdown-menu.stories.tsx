"use client";

import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import preview from "#.storybook/preview.ts";
import { Button } from "./button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu.tsx";

// A menu of Base UI, which opens in a portal at the end of the body. The
// story file has `"use client"`, so an arg can be a spy that the menu calls.
const meta = preview.type<{ args: { onSelect: (item: string) => void } }>().meta({
  title: "UI/DropdownMenu",
  component: DropdownMenu,
  parameters: { layout: "centered" },
  args: { onSelect: fn() },
  render: ({ onSelect }) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline">Sort notes</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => onSelect("updated")}>Last updated</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("title")}>Title</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

export const SelectAnItem = meta.story({
  async play({ args, canvas }) {
    await userEvent.click(await canvas.findByRole("button", { name: "Sort notes" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Title" }));

    await expect(args.onSelect).toHaveBeenCalledWith("title");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  },
});
