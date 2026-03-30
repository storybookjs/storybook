export type Data = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

export const fetchData = async (): Promise<Data[]> => {
  return Promise.resolve([
    {
      userId: 1,
      id: 1,
      title: 'mocked title',
      body: 'mocked body',
    },
  ]);
};
