import { useSearch } from '@tanstack/react-router';

export const SearchParamsDisplay = (): JSX.Element => {
  const { page, query } = useSearch({ from: '/search' });

  return (
    <div>
      <p data-testid="page">Page: {page}</p>
      <p data-testid="query">Query: {query}</p>
    </div>
  );
};
