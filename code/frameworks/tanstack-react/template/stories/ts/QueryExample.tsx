import { useQuery } from '@tanstack/react-query';

type Greeting = { message: string };

export const QueryExample = () => {
  const { data, isLoading, isError, error } = useQuery<Greeting>({
    queryKey: ['welcome-message'],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { message: 'Hello from TanStack Query' };
    },
  });

  if (isLoading) {
    return <p>Loading message…</p>;
  }

  if (isError) {
    return <p role="alert">Something went wrong: {(error as Error).message}</p>;
  }

  return (
    <div>
      <h3>TanStack Query Demo</h3>
      <p>{data?.message}</p>
    </div>
  );
};
