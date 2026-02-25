import type { Meta, StoryObj } from "@storybook/react";

import { createRootRoute, createRoute } from "@tanstack/react-router";
import { expect, within } from "storybook/test";

import {
  ArticleDetail,
  ArticleLoadingSpinner,
  ArticleErrorBanner,
  type Article,
} from "./LoaderMockingExample";

function createArticleRouteTree() {
  const rootRoute = createRootRoute({ component: () => null });
  const articleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/articles/$articleId",
    loader: async (): Promise<Article> => {
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/posts/1",
      );
      return response.json();
    },
    component: ArticleDetail,
  });
  return rootRoute.addChildren([articleRoute]);
}

const meta: Meta = {
  title: "TanStack/LoaderMocking",
  render: () => null,
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createArticleRouteTree,
        initialEntries: ["/articles/1"],
      },
    },
  },
};

export default meta;

export const WithMockLoader: StoryObj = {
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createArticleRouteTree,
        initialEntries: ["/articles/1"],
        mockLoaders: {
          "/articles/$articleId": () => ({
            id: "1",
            title: "Mocked Article",
            body: "Mocked body content.",
          }),
        },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = await canvas.findByText("Mocked Article");
    expect(title).toBeInTheDocument();
    const body = await canvas.findByText(/Mocked body content/);
    expect(body).toBeInTheDocument();
  },
};

export const Pending: StoryObj = {
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createArticleRouteTree,
        initialEntries: ["/articles/1"],
        forcePending: true,
        defaultPendingComponent: ArticleLoadingSpinner,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const spinner = await canvas.findByRole("status");
    expect(spinner).toBeInTheDocument();
    const loadingText = canvas.getByText(/Loading article/);
    expect(loadingText).toBeInTheDocument();
  },
};

export const ErrorState: StoryObj = {
  parameters: {
    tanstack: {
      router: {
        mode: "routeTree",
        createRouteTree: createArticleRouteTree,
        initialEntries: ["/articles/1"],
        forceError: new Error("Article not found"),
        defaultErrorComponent: ArticleErrorBanner,
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole("alert");
    expect(alert).toBeInTheDocument();
    const errorText = canvas.getByText(/Article not found/);
    expect(errorText).toBeInTheDocument();
  },
};
