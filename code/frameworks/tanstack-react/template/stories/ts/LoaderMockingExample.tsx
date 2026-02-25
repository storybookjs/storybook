import { useLoaderData } from '@tanstack/react-router';

export interface Article {
  id: string;
  title: string;
  body: string;
}

export const ArticleDetail = (): JSX.Element => {
  const article = useLoaderData({ from: '/articles/$articleId' }) as Article;

  return (
    <article>
      <h2>{article.title}</h2>
      <p>{article.body}</p>
    </article>
  );
};

export const ArticleLoadingSpinner = (): JSX.Element => (
  <div role="status">Loading article…</div>
);

export const ArticleErrorBanner = ({ error }: { error: Error }): JSX.Element => (
  <div role="alert">Error: {error.message}</div>
);
